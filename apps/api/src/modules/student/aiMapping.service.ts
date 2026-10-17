import ExcelJS from 'exceljs';
import OpenAI from 'openai';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';

const MODEL = 'gpt-4o-mini';
const SAMPLE_ROW_LIMIT = 5;
const MAX_ROWS = 500;

const TARGET_FIELDS = [
  { key: 'firstName', required: true, description: "Student's first name (single word)" },
  { key: 'lastName', required: true, description: "Student's last name / surname" },
  {
    key: 'dateOfBirth',
    required: true,
    description: 'Date of birth in YYYY-MM-DD format. Convert from any input format.',
  },
  {
    key: 'gender',
    required: true,
    description: 'One of: male, female, other. Map M/Boy → male, F/Girl → female.',
  },
  {
    key: 'className',
    required: true,
    description: 'Class name as a string, e.g. "10", "Class 10", "Grade 5". Use the value as-is.',
  },
  {
    key: 'sectionName',
    required: true,
    description: 'Section name, e.g. "A", "B", "Alpha". Use the value as-is.',
  },
  { key: 'rollNumber', required: false, description: 'Roll number / register number' },
  {
    key: 'category',
    required: false,
    description: 'One of: general, obc, sc, st. Normalise to lowercase.',
  },
  { key: 'phone', required: false, description: 'Student phone (10 digits Indian)' },
  { key: 'email', required: false, description: 'Student email' },
  { key: 'fatherName', required: false, description: "Father's full name" },
  { key: 'fatherPhone', required: false, description: "Father's phone" },
  { key: 'motherName', required: false, description: "Mother's full name" },
  { key: 'motherPhone', required: false, description: "Mother's phone" },
  { key: 'address', required: false, description: 'Street address / locality' },
  { key: 'city', required: false, description: 'City' },
  { key: 'state', required: false, description: 'State' },
  { key: 'pincode', required: false, description: '6-digit pincode' },
  {
    key: 'status',
    required: false,
    description:
      'One of: active, inactive, alumni, archived, transferred, withdrawn. Leave blank if unspecified.',
  },
  {
    key: 'admissionDate',
    required: false,
    description: 'Admission date in YYYY-MM-DD format',
  },
] as const;

type TargetFieldKey = (typeof TARGET_FIELDS)[number]['key'];

const TARGET_FIELD_KEYS: TargetFieldKey[] = TARGET_FIELDS.map((f) => f.key);

// Transform primitives applied deterministically on the backend after the AI
// returns its mapping plan. New transforms must also be added to the JSON
// schema enum below.
type Transform =
  | 'copy'
  | 'trim'
  | 'lowercase'
  | 'dateFromFormat'
  | 'valueMap'
  | 'splitFirstWord_first'
  | 'splitFirstWord_rest'
  | 'splitOnSeparator_first'
  | 'splitOnSeparator_rest'
  | 'concat';

interface MappingEntry {
  targetField: TargetFieldKey;
  sourceColumns: string[];
  transform: Transform;
  /** Source date format for dateFromFormat, e.g. "DD/MM/YYYY" or "MM-DD-YYYY". */
  format?: string;
  /** Lower-cased input → output, for valueMap. */
  valueMap?: Record<string, string>;
  /** Separator for splitOnSeparator (e.g. "-" for "10-A"). */
  separator?: string;
  /** Joiner for concat (e.g. ", "). */
  joiner?: string;
}

interface MappingPlan {
  mappings: MappingEntry[];
  unmappedColumns: string[];
  missingRequiredFields: TargetFieldKey[];
  warnings: string[];
}

export interface AiParseResult {
  rows: Record<string, string>[];
  mapping: MappingPlan;
  totalRows: number;
  headers: string[];
}

class AiMappingService {
  private client: OpenAI | null = null;

  isConfigured(): boolean {
    return !!env.OPENAI_API_KEY;
  }

  private getClient(): OpenAI {
    if (!env.OPENAI_API_KEY) {
      throw new ApiError(
        'AI_NOT_CONFIGURED',
        'OPENAI_API_KEY is not set. The AI-assisted upload endpoint is disabled.',
        503
      );
    }
    if (!this.client) {
      this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    }
    return this.client;
  }

  /**
   * Parse an uploaded file (xlsx/xls/csv) and return its headers and rows as
   * 2-D string arrays. The first non-empty row is treated as the header row.
   */
  async parseFile(
    buffer: Buffer,
    filename: string
  ): Promise<{ headers: string[]; rows: string[][] }> {
    const ext = filename.toLowerCase().split('.').pop();

    if (ext === 'csv') {
      return this.parseCsv(buffer.toString('utf8'));
    }
    if (ext === 'xlsx' || ext === 'xls') {
      return this.parseExcel(buffer);
    }
    throw new ApiError(
      'UNSUPPORTED_FILE_TYPE',
      'Only .csv, .xls, and .xlsx files are supported',
      400
    );
  }

  private parseCsv(content: string): { headers: string[]; rows: string[][] } {
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return { headers: [], rows: [] };
    const headers = this.parseCsvLine(lines[0]);
    const rows: string[][] = [];
    for (let i = 1; i < lines.length && rows.length < MAX_ROWS; i++) {
      const cells = this.parseCsvLine(lines[i]);
      // Skip rows that are entirely empty (e.g. trailing commas).
      if (cells.every((c) => c.trim() === '')) continue;
      rows.push(cells);
    }
    return { headers, rows };
  }

  private parseCsvLine(line: string): string[] {
    const out: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        // Support escaped quotes ("") inside a quoted field.
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = !inQ;
        }
      } else if (ch === ',' && !inQ) {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  }

  private async parseExcel(buffer: Buffer): Promise<{ headers: string[]; rows: string[][] }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new ApiError('EMPTY_WORKBOOK', 'The uploaded file has no worksheets', 400);
    }

    const allRows: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      const colCount = sheet.columnCount || (row.values as unknown[]).length;
      for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c);
        cells.push(this.formatExcelCell(cell));
      }
      allRows.push(cells);
    });

    if (allRows.length === 0) return { headers: [], rows: [] };
    const headers = allRows[0].map((h) => h.trim());
    const body = allRows
      .slice(1)
      .filter((r) => r.some((c) => c.trim() !== ''))
      .slice(0, MAX_ROWS);
    return { headers, rows: body };
  }

  private formatExcelCell(cell: ExcelJS.Cell): string {
    const v = cell.value;
    if (v === null || v === undefined) return '';
    if (v instanceof Date) {
      // Use ISO date (YYYY-MM-DD) so dates survive without timezone drift.
      const yyyy = v.getUTCFullYear();
      const mm = String(v.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(v.getUTCDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    if (typeof v === 'object') {
      // ExcelJS rich text / formula / hyperlink results
      const asAny = v as { text?: string; result?: unknown; richText?: { text: string }[] };
      if (asAny.richText) return asAny.richText.map((r) => r.text).join('');
      if (asAny.text) return String(asAny.text);
      if (asAny.result !== undefined) return String(asAny.result);
      return '';
    }
    return String(v);
  }

  /**
   * Ask OpenAI to produce a mapping plan from arbitrary source headers to our
   * known target fields. Sends headers + a small sample of rows for context.
   */
  async getMappingPlan(headers: string[], sampleRows: string[][]): Promise<MappingPlan> {
    if (headers.length === 0) {
      throw new ApiError('NO_HEADERS', 'The uploaded file has no header row', 400);
    }
    const client = this.getClient();

    const samples = sampleRows.slice(0, SAMPLE_ROW_LIMIT);
    const userPayload = {
      targetSchema: TARGET_FIELDS,
      sourceHeaders: headers,
      sampleRows: samples,
    };

    const systemPrompt = `You map arbitrary spreadsheet columns to a school's student-import schema.

Given source headers and sample rows, return a mapping plan that explains how to produce each target field from one or more source columns. Use transforms:
- "copy": use the source column verbatim
- "trim" / "lowercase": normalise whitespace / case
- "dateFromFormat": specify "format" using DD/MM/YYYY style tokens (DD, MM, YYYY, YY) — output is always YYYY-MM-DD
- "valueMap": provide a "valueMap" object mapping lower-cased input → canonical output (e.g. {"m":"male","f":"female","boy":"male","girl":"female"})
- "splitFirstWord_first" / "splitFirstWord_rest": for splitting "Full Name" → firstName / lastName. _first returns the first whitespace-delimited token; _rest returns everything after it.
- "splitOnSeparator_first" / "splitOnSeparator_rest": split by a "separator" (e.g. "-" for "10-A"). _first returns the part before the first separator, _rest returns the remainder.
- "concat": combine multiple sourceColumns with a "joiner" string.

CRITICAL RULES — read carefully, mistakes here cause silent data loss:

1. When ONE source column encodes TWO target fields joined by a separator, you MUST emit two mappings — one with _first and one with _rest — both pointing to the SAME sourceColumn. Never use "copy" on a column whose value contains the separator if the target fields are different concepts.
   Example: source "Standard-Div" with samples ["10-A","9-B"] and targets className + sectionName →
     { targetField: "className",   sourceColumns: ["Standard-Div"], transform: "splitOnSeparator_first", separator: "-" }
     { targetField: "sectionName", sourceColumns: ["Standard-Div"], transform: "splitOnSeparator_rest",  separator: "-" }
   Same pattern for a combined "Grade/Section", "Class Sec", "Std-Sec", etc.

2. Same rule for a single name column. "Student Name" / "Full Name" / "Name" with values like "Aarav Kumar Sharma" → emit BOTH:
     { targetField: "firstName", sourceColumns: ["Student Name"], transform: "splitFirstWord_first" }
     { targetField: "lastName",  sourceColumns: ["Student Name"], transform: "splitFirstWord_rest"  }

3. NEVER split identifier-like fields even if they contain "-" or "/". Roll numbers, reg numbers, admission numbers, pincodes, phone numbers, emails are atomic strings — always use "copy" for them. A value like "2024-001" in a "Reg No" / "Roll #" column maps to rollNumber with transform "copy", NOT split.

4. For gender, always include both abbreviated and full forms in valueMap: {"m":"male","male":"male","boy":"male","f":"female","female":"female","girl":"female","o":"other","other":"other"}.

5. For category, lowercase the value: valueMap like {"general":"general","obc":"obc","sc":"sc","st":"st"}.

6. Status values like "active"/"alumni"/"archived"/"transferred"/"withdrawn"/"inactive" can use "lowercase". If status is unspecified in the source, do not emit a mapping for it.

7. Only emit mappings for target fields you can derive from the source. Never invent.

8. List source headers you didn't use in "unmappedColumns". List required target fields you couldn't map in "missingRequiredFields". Use "warnings" for ambiguity (e.g. "DOB could be DD/MM/YYYY or MM/DD/YYYY — assumed DD/MM/YYYY based on day values > 12").`;

    const response = await client.chat.completions.create({
      model: MODEL,
      temperature: 0,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(userPayload) },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'mapping_plan',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              mappings: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    targetField: { type: 'string', enum: TARGET_FIELD_KEYS },
                    sourceColumns: { type: 'array', items: { type: 'string' } },
                    transform: {
                      type: 'string',
                      enum: [
                        'copy',
                        'trim',
                        'lowercase',
                        'dateFromFormat',
                        'valueMap',
                        'splitFirstWord_first',
                        'splitFirstWord_rest',
                        'splitOnSeparator_first',
                        'splitOnSeparator_rest',
                        'concat',
                      ],
                    },
                    format: { type: ['string', 'null'] },
                    valueMap: {
                      type: ['object', 'null'],
                      additionalProperties: { type: 'string' },
                    },
                    separator: { type: ['string', 'null'] },
                    joiner: { type: ['string', 'null'] },
                  },
                  required: [
                    'targetField',
                    'sourceColumns',
                    'transform',
                    'format',
                    'valueMap',
                    'separator',
                    'joiner',
                  ],
                },
              },
              unmappedColumns: { type: 'array', items: { type: 'string' } },
              missingRequiredFields: {
                type: 'array',
                items: { type: 'string', enum: TARGET_FIELD_KEYS },
              },
              warnings: { type: 'array', items: { type: 'string' } },
            },
            required: ['mappings', 'unmappedColumns', 'missingRequiredFields', 'warnings'],
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new ApiError('AI_EMPTY_RESPONSE', 'OpenAI returned no mapping plan', 502);
    }

    let plan: MappingPlan;
    try {
      plan = JSON.parse(content) as MappingPlan;
    } catch {
      throw new ApiError('AI_INVALID_RESPONSE', 'OpenAI returned malformed JSON', 502);
    }

    // The model may return target fields outside our known set (shouldn't with
    // strict schema, but guard anyway).
    plan.mappings = plan.mappings.filter((m) =>
      TARGET_FIELD_KEYS.includes(m.targetField as TargetFieldKey)
    );
    return plan;
  }

  /**
   * Apply a mapping plan to every row deterministically. Each output row is a
   * `Record<string, string>` shaped exactly like the existing BulkStudentRow
   * the validate/process endpoints already consume.
   */
  applyMapping(headers: string[], rows: string[][], plan: MappingPlan): Record<string, string>[] {
    const headerIndex: Record<string, number> = {};
    headers.forEach((h, i) => {
      headerIndex[h] = i;
    });

    return rows.map((row) => {
      const out: Record<string, string> = {};
      for (const m of plan.mappings) {
        const sources = m.sourceColumns
          .map((col) => {
            const idx = headerIndex[col];
            return idx === undefined ? '' : (row[idx] ?? '').toString();
          })
          .map((s) => s.trim());
        const value = this.applyTransform(m, sources);
        if (value !== '' && value !== undefined && value !== null) {
          out[m.targetField] = value;
        }
      }
      return out;
    });
  }

  private applyTransform(m: MappingEntry, sources: string[]): string {
    const first = sources[0] ?? '';
    switch (m.transform) {
      case 'copy':
        return first;
      case 'trim':
        return first.trim();
      case 'lowercase':
        return first.toLowerCase();
      case 'dateFromFormat':
        return this.convertDate(first, m.format ?? 'DD/MM/YYYY');
      case 'valueMap': {
        const map = m.valueMap ?? {};
        const key = first.toLowerCase().trim();
        return map[key] ?? map[first] ?? first;
      }
      case 'splitFirstWord_first': {
        const parts = first.trim().split(/\s+/);
        return parts[0] ?? '';
      }
      case 'splitFirstWord_rest': {
        const parts = first.trim().split(/\s+/);
        return parts.slice(1).join(' ');
      }
      case 'splitOnSeparator_first': {
        const sep = m.separator || '-';
        const idx = first.indexOf(sep);
        return idx === -1 ? first : first.slice(0, idx).trim();
      }
      case 'splitOnSeparator_rest': {
        const sep = m.separator || '-';
        const idx = first.indexOf(sep);
        return idx === -1 ? '' : first.slice(idx + sep.length).trim();
      }
      case 'concat': {
        const joiner = m.joiner ?? ' ';
        return sources.filter((s) => s.length > 0).join(joiner);
      }
      default:
        return first;
    }
  }

  /**
   * Convert a value like "15/08/2010" into "2010-08-15". Returns the original
   * input unchanged if it doesn't match the expected token shape — downstream
   * validation will surface the row to the user for manual fix.
   */
  private convertDate(value: string, format: string): string {
    if (!value) return '';
    const v = value.trim();
    // Already ISO? Pass through.
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);

    const fmt = format.toUpperCase();
    const tokenRegex = /(YYYY|YY|MM|DD)/g;
    const tokens: string[] = [];
    let separator = '';
    let m: RegExpExecArray | null;
    let lastEnd = 0;
    while ((m = tokenRegex.exec(fmt)) !== null) {
      tokens.push(m[1]);
      if (lastEnd > 0 && !separator) separator = fmt.slice(lastEnd, m.index);
      lastEnd = m.index + m[1].length;
    }
    if (tokens.length === 0) return v;

    const sepCandidates = [separator, '/', '-', '.', ' '].filter(Boolean);
    let parts: string[] = [];
    for (const sep of sepCandidates) {
      const split = v.split(sep);
      if (split.length === tokens.length) {
        parts = split;
        break;
      }
    }
    if (parts.length !== tokens.length) return v;

    let yyyy = '';
    let mm = '';
    let dd = '';
    tokens.forEach((tok, i) => {
      const part = parts[i].trim();
      if (tok === 'YYYY') yyyy = part;
      else if (tok === 'YY') yyyy = `20${part.padStart(2, '0')}`;
      else if (tok === 'MM') mm = part.padStart(2, '0');
      else if (tok === 'DD') dd = part.padStart(2, '0');
    });
    if (!yyyy || !mm || !dd) return v;
    return `${yyyy}-${mm}-${dd}`;
  }

  /**
   * Top-level entry point used by the controller: parse → map → apply.
   */
  async parseAndMap(buffer: Buffer, filename: string): Promise<AiParseResult> {
    const { headers, rows } = await this.parseFile(buffer, filename);
    if (headers.length === 0 || rows.length === 0) {
      throw new ApiError(
        'EMPTY_FILE',
        'The uploaded file has no data rows under its header row',
        400
      );
    }

    const plan = await this.getMappingPlan(headers, rows);

    logger.info(
      {
        headers,
        mappedFields: plan.mappings.map((m) => m.targetField),
        unmappedColumns: plan.unmappedColumns,
        missingRequiredFields: plan.missingRequiredFields,
        warnings: plan.warnings,
        rowCount: rows.length,
      },
      'AI bulk-upload mapping plan generated'
    );

    const mappedRows = this.applyMapping(headers, rows, plan);
    return { rows: mappedRows, mapping: plan, totalRows: rows.length, headers };
  }
}

export const aiMappingService = new AiMappingService();
