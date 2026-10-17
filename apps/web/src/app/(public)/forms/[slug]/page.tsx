'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DatePicker } from '@/components/ui/date-picker';
import { publicFormsApi } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, AlertCircle, Upload } from 'lucide-react';

interface FormField {
  id: string;
  type:
    | 'text'
    | 'textarea'
    | 'email'
    | 'phone'
    | 'number'
    | 'date'
    | 'select'
    | 'radio'
    | 'checkbox'
    | 'file'
    | 'section';
  name: string;
  label: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  validation?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
    acceptedFileTypes?: string[];
    maxFileSize?: number;
  };
  options?: Array<{ value: string; label: string }>;
  defaultValue?: string | boolean;
  width?: 'full' | 'half' | 'third';
  order: number;
}

interface FormData {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  type: string;
  status: string;
  fields: FormField[];
  settings: {
    collectPayment?: boolean;
    paymentAmount?: number;
    redirectUrl?: string;
    confirmationMessage?: string;
    notifyOnSubmission?: boolean;
    notifyEmails?: string[];
    autoCreateLead?: boolean;
  };
  styling?: {
    headerImage?: string;
    logo?: string;
    primaryColor?: string;
    backgroundColor?: string;
  };
  branchName?: string;
  tenantName?: string;
}

export default function PublicFormPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormData | null>(null);
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetchForm();
  }, [slug]);

  const fetchForm = async () => {
    setLoading(true);
    try {
      const response = await publicFormsApi.getForm(slug);
      if (response.success) {
        setForm(response.data);

        // Initialize form values with defaults
        const defaults: Record<string, unknown> = {};
        response.data.fields?.forEach((field: FormField) => {
          if (field.defaultValue !== undefined) {
            defaults[field.name] = field.defaultValue;
          } else if (field.type === 'checkbox') {
            defaults[field.name] = false;
          }
        });
        setFormValues(defaults);
      } else {
        setNotFound(true);
      }
    } catch (error) {
      console.error('Failed to fetch form:', error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    if (!form) return false;

    const newErrors: Record<string, string> = {};

    form.fields.forEach((field) => {
      const value = formValues[field.name];

      // Required validation
      if (field.required) {
        if (value === undefined || value === null || value === '') {
          newErrors[field.name] = `${field.label} is required`;
          return;
        }
      }

      // Type-specific validations
      if (value && field.validation) {
        if (field.type === 'text' || field.type === 'textarea') {
          const strValue = String(value);
          if (field.validation.minLength && strValue.length < field.validation.minLength) {
            newErrors[field.name] = `Minimum ${field.validation.minLength} characters required`;
          }
          if (field.validation.maxLength && strValue.length > field.validation.maxLength) {
            newErrors[field.name] = `Maximum ${field.validation.maxLength} characters allowed`;
          }
        }

        if (field.type === 'number') {
          const numValue = Number(value);
          if (field.validation.min !== undefined && numValue < field.validation.min) {
            newErrors[field.name] = `Minimum value is ${field.validation.min}`;
          }
          if (field.validation.max !== undefined && numValue > field.validation.max) {
            newErrors[field.name] = `Maximum value is ${field.validation.max}`;
          }
        }

        if (field.type === 'email' && value) {
          const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailPattern.test(String(value))) {
            newErrors[field.name] = 'Please enter a valid email address';
          }
        }

        if (field.type === 'phone' && value) {
          const phonePattern = /^[+]?[\d\s-()]{10,}$/;
          if (!phonePattern.test(String(value))) {
            newErrors[field.name] = 'Please enter a valid phone number';
          }
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    setSubmitting(true);
    try {
      const response = await publicFormsApi.submitForm(slug, {
        data: formValues,
      });

      if (response.success) {
        setSubmitted(true);

        // Redirect if configured
        if (form?.settings?.redirectUrl) {
          setTimeout(() => {
            window.location.href = form.settings.redirectUrl!;
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Failed to submit form:', error);
      toast.error('Failed to submit form. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const updateValue = (fieldName: string, value: unknown) => {
    setFormValues((prev) => ({ ...prev, [fieldName]: value }));
    // Clear error when value changes
    if (errors[fieldName]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  const getWidthClass = (width?: string): string => {
    switch (width) {
      case 'half':
        return 'md:col-span-1';
      case 'third':
        return 'md:col-span-1';
      default:
        return 'md:col-span-2';
    }
  };

  const primaryColor = form?.styling?.primaryColor || '#3b82f6';
  const backgroundColor = form?.styling?.backgroundColor || '#ffffff';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">Form Not Found</h2>
            <p className="text-muted-foreground">
              This form may have been removed or is no longer accepting submissions.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (form.status !== 'published') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">Form Not Available</h2>
            <p className="text-muted-foreground">
              This form is not currently accepting submissions.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div
              className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{ backgroundColor: `${primaryColor}20` }}
            >
              <CheckCircle2 className="h-8 w-8" style={{ color: primaryColor }} />
            </div>
            <h2 className="text-xl font-semibold mb-2">Thank You!</h2>
            <p className="text-muted-foreground">
              {form.settings?.confirmationMessage ||
                'Your submission has been received successfully.'}
            </p>
            {form.settings?.redirectUrl && (
              <p className="text-sm text-muted-foreground mt-4">Redirecting...</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4" style={{ backgroundColor }}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        {(form.styling?.logo || form.styling?.headerImage) && (
          <div className="mb-6 text-center">
            {form.styling?.logo && (
              <Image
                src={form.styling.logo}
                alt="Logo"
                width={150}
                height={50}
                className="h-12 w-auto mx-auto mb-4"
              />
            )}
            {form.styling?.headerImage && (
              <div className="relative h-40 w-full rounded-lg overflow-hidden mb-4">
                <Image src={form.styling.headerImage} alt="Header" fill className="object-cover" />
              </div>
            )}
          </div>
        )}

        {/* Form Card */}
        <Card className="shadow-lg">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl">{form.name}</CardTitle>
            {form.description && (
              <CardDescription className="text-base">{form.description}</CardDescription>
            )}
            {(form.tenantName || form.branchName) && (
              <p className="text-sm text-muted-foreground">
                {form.tenantName}
                {form.branchName && ` - ${form.branchName}`}
              </p>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {form.fields
                  .sort((a, b) => a.order - b.order)
                  .map((field) => {
                    // Section divider
                    if (field.type === 'section') {
                      return (
                        <div key={field.id} className="col-span-full pt-4 pb-2">
                          <h3 className="font-semibold text-lg" style={{ color: primaryColor }}>
                            {field.label}
                          </h3>
                          {field.helpText && (
                            <p className="text-sm text-muted-foreground">{field.helpText}</p>
                          )}
                          <hr className="mt-2" />
                        </div>
                      );
                    }

                    return (
                      <div key={field.id} className={`space-y-2 ${getWidthClass(field.width)}`}>
                        <Label
                          htmlFor={field.id}
                          className={errors[field.name] ? 'text-destructive' : ''}
                        >
                          {field.label}
                          {field.required && <span className="text-destructive ml-1">*</span>}
                        </Label>

                        {/* Text Input */}
                        {field.type === 'text' && (
                          <Input
                            id={field.id}
                            value={(formValues[field.name] as string) || ''}
                            onChange={(e) => updateValue(field.name, e.target.value)}
                            placeholder={field.placeholder}
                            className={errors[field.name] ? 'border-destructive' : ''}
                          />
                        )}

                        {/* Textarea */}
                        {field.type === 'textarea' && (
                          <Textarea
                            id={field.id}
                            value={(formValues[field.name] as string) || ''}
                            onChange={(e) => updateValue(field.name, e.target.value)}
                            placeholder={field.placeholder}
                            rows={4}
                            className={errors[field.name] ? 'border-destructive' : ''}
                          />
                        )}

                        {/* Email */}
                        {field.type === 'email' && (
                          <Input
                            id={field.id}
                            type="email"
                            value={(formValues[field.name] as string) || ''}
                            onChange={(e) => updateValue(field.name, e.target.value)}
                            placeholder={field.placeholder || 'email@example.com'}
                            className={errors[field.name] ? 'border-destructive' : ''}
                          />
                        )}

                        {/* Phone */}
                        {field.type === 'phone' && (
                          <Input
                            id={field.id}
                            type="tel"
                            value={(formValues[field.name] as string) || ''}
                            onChange={(e) => updateValue(field.name, e.target.value)}
                            placeholder={field.placeholder || '+91 98765 43210'}
                            className={errors[field.name] ? 'border-destructive' : ''}
                          />
                        )}

                        {/* Number */}
                        {field.type === 'number' && (
                          <Input
                            id={field.id}
                            type="number"
                            value={(formValues[field.name] as string) || ''}
                            onChange={(e) => updateValue(field.name, e.target.value)}
                            placeholder={field.placeholder}
                            min={field.validation?.min}
                            max={field.validation?.max}
                            className={errors[field.name] ? 'border-destructive' : ''}
                          />
                        )}

                        {/* Date */}
                        {field.type === 'date' && (
                          <DatePicker
                            id={field.id}
                            value={(formValues[field.name] as string) || ''}
                            onChange={(iso) => updateValue(field.name, iso)}
                            className={errors[field.name] ? 'border-destructive' : ''}
                          />
                        )}

                        {/* Select */}
                        {field.type === 'select' && (
                          <Select
                            value={(formValues[field.name] as string) || ''}
                            onValueChange={(value) => updateValue(field.name, value)}
                          >
                            <SelectTrigger
                              className={errors[field.name] ? 'border-destructive' : ''}
                            >
                              <SelectValue placeholder={field.placeholder || 'Select an option'} />
                            </SelectTrigger>
                            <SelectContent>
                              {field.options?.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}

                        {/* Radio */}
                        {field.type === 'radio' && (
                          <RadioGroup
                            value={(formValues[field.name] as string) || ''}
                            onValueChange={(value: string) => updateValue(field.name, value)}
                          >
                            {field.options?.map((option) => (
                              <div key={option.value} className="flex items-center space-x-2">
                                <RadioGroupItem
                                  value={option.value}
                                  id={`${field.id}-${option.value}`}
                                />
                                <Label
                                  htmlFor={`${field.id}-${option.value}`}
                                  className="font-normal cursor-pointer"
                                >
                                  {option.label}
                                </Label>
                              </div>
                            ))}
                          </RadioGroup>
                        )}

                        {/* Checkbox */}
                        {field.type === 'checkbox' && (
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={field.id}
                              checked={(formValues[field.name] as boolean) || false}
                              onCheckedChange={(checked) => updateValue(field.name, checked)}
                            />
                            <Label htmlFor={field.id} className="font-normal cursor-pointer">
                              {field.placeholder || 'Yes'}
                            </Label>
                          </div>
                        )}

                        {/* File upload placeholder */}
                        {field.type === 'file' && (
                          <div className="border-2 border-dashed rounded-lg p-4 text-center">
                            <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">File upload coming soon</p>
                          </div>
                        )}

                        {/* Help text and error */}
                        {field.helpText && !errors[field.name] && (
                          <p className="text-xs text-muted-foreground">{field.helpText}</p>
                        )}
                        {errors[field.name] && (
                          <p className="text-xs text-destructive">{errors[field.name]}</p>
                        )}
                      </div>
                    );
                  })}
              </div>

              {/* Submit Button */}
              <div className="mt-6 pt-4 border-t">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitting}
                  style={{
                    backgroundColor: primaryColor,
                  }}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">Powered by Campus Verse</p>
      </div>
    </div>
  );
}
