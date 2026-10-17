'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, CheckCircle2, CircleDot, ToggleLeft, Type } from 'lucide-react';

export interface Question {
  type: 'mcq' | 'short_answer' | 'true_false';
  question: string;
  options: string[];
  correctAnswer: string;
  marks: number;
}

export const emptyQuestion = (): Question => ({
  type: 'mcq',
  question: '',
  options: ['', '', '', ''],
  correctAnswer: '',
  marks: 1,
});

interface QuestionEditorProps {
  questions: Question[];
  onChange: (questions: Question[]) => void;
}

export function QuestionEditor({ questions, onChange }: QuestionEditorProps) {
  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);

  const updateQuestion = (index: number, updates: Partial<Question>) => {
    onChange(questions.map((q, i) => (i === index ? { ...q, ...updates } : q)));
  };

  const removeQuestion = (index: number) => {
    onChange(questions.filter((_, i) => i !== index));
  };

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    onChange(
      questions.map((q, i) => {
        if (i !== qIndex) return q;
        const newOptions = [...q.options];
        newOptions[oIndex] = value;
        return { ...q, options: newOptions };
      })
    );
  };

  return (
    <div className="space-y-3">
      {questions.map((q, idx) => (
        <div key={idx} className="border rounded-lg p-3 space-y-3 bg-muted/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px] px-1.5">
                Q{idx + 1}
              </Badge>
              <Select
                value={q.type}
                onValueChange={(val) =>
                  updateQuestion(idx, {
                    type: val as Question['type'],
                    options: val === 'mcq' ? ['', '', '', ''] : [],
                    correctAnswer: val === 'true_false' ? 'true' : '',
                  })
                }
              >
                <SelectTrigger className="h-7 w-[140px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcq">
                    <span className="flex items-center gap-1.5">
                      <CircleDot className="h-3 w-3" /> MCQ
                    </span>
                  </SelectItem>
                  <SelectItem value="true_false">
                    <span className="flex items-center gap-1.5">
                      <ToggleLeft className="h-3 w-3" /> True/False
                    </span>
                  </SelectItem>
                  <SelectItem value="short_answer">
                    <span className="flex items-center gap-1.5">
                      <Type className="h-3 w-3" /> Short Answer
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                value={q.marks}
                onChange={(e) => updateQuestion(idx, { marks: parseInt(e.target.value) || 1 })}
                className="h-7 w-16 text-xs text-center"
              />
              <span className="text-[10px] text-muted-foreground">marks</span>
              {questions.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => removeQuestion(idx)}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              )}
            </div>
          </div>

          <Input
            value={q.question}
            onChange={(e) => updateQuestion(idx, { question: e.target.value })}
            placeholder="Enter question..."
            className="h-8 text-sm"
          />

          {/* MCQ Options */}
          {q.type === 'mcq' && (
            <div className="space-y-1.5 pl-2">
              {q.options.map((opt, oIdx) => (
                <div key={oIdx} className="flex items-center gap-2">
                  <button
                    type="button"
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      q.correctAnswer === opt && opt.trim()
                        ? 'border-green-500 bg-green-500'
                        : 'border-muted-foreground/30'
                    }`}
                    onClick={() => opt.trim() && updateQuestion(idx, { correctAnswer: opt })}
                  >
                    {q.correctAnswer === opt && opt.trim() && (
                      <CheckCircle2 className="h-3 w-3 text-white" />
                    )}
                  </button>
                  <Input
                    value={opt}
                    onChange={(e) => updateOption(idx, oIdx, e.target.value)}
                    placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                    className="h-7 text-xs flex-1"
                  />
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground pl-7">
                Click the circle to mark the correct answer
              </p>
            </div>
          )}

          {/* True/False */}
          {q.type === 'true_false' && (
            <div className="flex gap-2 pl-2">
              {['true', 'false'].map((val) => (
                <Button
                  key={val}
                  type="button"
                  variant={q.correctAnswer === val ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs capitalize flex-1"
                  onClick={() => updateQuestion(idx, { correctAnswer: val })}
                >
                  {val}
                </Button>
              ))}
            </div>
          )}

          {/* Short Answer */}
          {q.type === 'short_answer' && (
            <Input
              value={q.correctAnswer}
              onChange={(e) => updateQuestion(idx, { correctAnswer: e.target.value })}
              placeholder="Expected answer..."
              className="h-7 text-xs"
            />
          )}
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-1.5"
        onClick={() => onChange([...questions, emptyQuestion()])}
      >
        <Plus className="h-3 w-3" /> Add Question
      </Button>

      <p className="text-xs text-muted-foreground">
        {questions.length} question{questions.length !== 1 ? 's' : ''} · {totalMarks} marks total
      </p>
    </div>
  );
}
