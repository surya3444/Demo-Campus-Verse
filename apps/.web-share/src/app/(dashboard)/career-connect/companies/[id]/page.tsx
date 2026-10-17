'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { careerConnectApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Edit,
  Building2,
  MapPin,
  Globe,
  Phone,
  Mail,
  User,
  Plus,
  Trash2,
  CalendarDays,
} from 'lucide-react';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  blacklisted: 'bg-red-100 text-red-800',
};

interface Contact {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  designation: string;
  isPrimary: boolean;
}

interface Visit {
  _id: string;
  date: string;
  purpose: string;
  contactPerson: string;
  notes?: string;
}

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const id = params.id as string;
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [visitDialogOpen, setVisitDialogOpen] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    phone: '',
    designation: '',
    isPrimary: false,
  });
  const [visitForm, setVisitForm] = useState({
    date: new Date().toISOString().split('T')[0],
    purpose: '',
    contactPerson: '',
    notes: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['company', id],
    queryFn: () => careerConnectApi.getCompany(id),
  });

  const addContactMutation = useMutation({
    mutationFn: (contactData: Record<string, unknown>) =>
      careerConnectApi.addCompanyContact(id, contactData),
    onSuccess: () => {
      toast.success('Contact added');
      queryClient.invalidateQueries({ queryKey: ['company', id] });
      setContactDialogOpen(false);
      setContactForm({ name: '', email: '', phone: '', designation: '', isPrimary: false });
    },
    onError: () => toast.error('Failed to add contact'),
  });

  const removeContactMutation = useMutation({
    mutationFn: (contactId: string) => careerConnectApi.removeCompanyContact(id, contactId),
    onSuccess: () => {
      toast.success('Contact removed');
      queryClient.invalidateQueries({ queryKey: ['company', id] });
    },
    onError: () => toast.error('Failed to remove contact'),
  });

  const addVisitMutation = useMutation({
    mutationFn: (visitData: Record<string, unknown>) =>
      careerConnectApi.addCompanyVisit(id, visitData),
    onSuccess: () => {
      toast.success('Visit logged');
      queryClient.invalidateQueries({ queryKey: ['company', id] });
      setVisitDialogOpen(false);
      setVisitForm({
        date: new Date().toISOString().split('T')[0],
        purpose: '',
        contactPerson: '',
        notes: '',
      });
    },
    onError: () => toast.error('Failed to log visit'),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => careerConnectApi.updateCompanyStatus(id, status),
    onSuccess: () => {
      toast.success('Status updated');
      queryClient.invalidateQueries({ queryKey: ['company', id] });
    },
    onError: () => toast.error('Failed to update status'),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const company = data?.data;

  if (!company) {
    return (
      <div className="text-center py-12">
        <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium">Company not found</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{company.name}</h1>
              <Badge variant="secondary" className={statusColors[company.status] || ''}>
                {company.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">{company.industry}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {hasPermission('careerConnect.companies', 'edit') && (
            <>
              {company.status === 'active' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => statusMutation.mutate('inactive')}
                >
                  Deactivate
                </Button>
              )}
              {company.status === 'inactive' && (
                <Button variant="outline" size="sm" onClick={() => statusMutation.mutate('active')}>
                  Activate
                </Button>
              )}
              <Button size="sm" onClick={() => router.push(`/career-connect/companies/${id}/edit`)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {company.size && (
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="capitalize">{company.size}</span>
                </div>
              )}
              {company.locations?.length > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span>{company.locations.join(', ')}</span>
                </div>
              )}
              {company.website && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {company.website}
                  </a>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Partnership</span>
                <span className="capitalize">{company.partnership?.type || 'Regular'}</span>
              </div>
              {company.sector && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sector</span>
                  <span>{company.sector}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contacts</span>
                <span>{company.hrContacts?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Visits</span>
                <span>{company.visitHistory?.length || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            {company.description ? (
              <p className="text-sm">{company.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No description added</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="contacts">
        <TabsList>
          <TabsTrigger value="contacts">
            HR Contacts ({company.hrContacts?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="visits">
            Visit History ({company.visitHistory?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>HR Contacts</CardTitle>
              {hasPermission('careerConnect.companies', 'edit') && (
                <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Contact
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add HR Contact</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Name *</Label>
                        <Input
                          value={contactForm.name}
                          onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email *</Label>
                        <Input
                          type="email"
                          value={contactForm.email}
                          onChange={(e) =>
                            setContactForm({ ...contactForm, email: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input
                          value={contactForm.phone}
                          onChange={(e) =>
                            setContactForm({ ...contactForm, phone: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Designation *</Label>
                        <Input
                          value={contactForm.designation}
                          onChange={(e) =>
                            setContactForm({ ...contactForm, designation: e.target.value })
                          }
                        />
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => addContactMutation.mutate(contactForm)}
                        disabled={
                          !contactForm.name ||
                          !contactForm.email ||
                          !contactForm.designation ||
                          addContactMutation.isPending
                        }
                      >
                        {addContactMutation.isPending ? 'Adding...' : 'Add Contact'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {!company.hrContacts || company.hrContacts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No contacts added yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Designation</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead className="w-[60px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {company.hrContacts.map((contact: Contact) => (
                      <TableRow key={contact._id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {contact.name}
                            {contact.isPrimary && (
                              <Badge variant="outline" className="text-xs">
                                Primary
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{contact.designation}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {contact.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          {contact.phone ? (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {contact.phone}
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {hasPermission('careerConnect.companies', 'edit') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeContactMutation.mutate(contact._id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visits" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Visit History</CardTitle>
              {hasPermission('careerConnect.companies', 'edit') && (
                <Dialog open={visitDialogOpen} onOpenChange={setVisitDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Log Visit
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Log Company Visit</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Date *</Label>
                        <DatePicker
                          value={visitForm.date}
                          onChange={(iso) => setVisitForm({ ...visitForm, date: iso })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Purpose *</Label>
                        <Input
                          value={visitForm.purpose}
                          onChange={(e) => setVisitForm({ ...visitForm, purpose: e.target.value })}
                          placeholder="e.g. Campus drive discussion"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Contact Person *</Label>
                        <Input
                          value={visitForm.contactPerson}
                          onChange={(e) =>
                            setVisitForm({ ...visitForm, contactPerson: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Notes</Label>
                        <Input
                          value={visitForm.notes}
                          onChange={(e) => setVisitForm({ ...visitForm, notes: e.target.value })}
                        />
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => addVisitMutation.mutate(visitForm)}
                        disabled={
                          !visitForm.date ||
                          !visitForm.purpose ||
                          !visitForm.contactPerson ||
                          addVisitMutation.isPending
                        }
                      >
                        {addVisitMutation.isPending ? 'Logging...' : 'Log Visit'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {!company.visitHistory || company.visitHistory.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No visits recorded yet</p>
              ) : (
                <div className="space-y-4">
                  {company.visitHistory
                    .sort(
                      (a: Visit, b: Visit) =>
                        new Date(b.date).getTime() - new Date(a.date).getTime()
                    )
                    .map((visit: Visit) => (
                      <div key={visit._id} className="flex items-start gap-3 rounded-lg border p-4">
                        <CalendarDays className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="font-medium">{visit.purpose}</p>
                            <span className="text-sm text-muted-foreground">
                              {new Date(visit.date).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Contact: {visit.contactPerson}
                          </p>
                          {visit.notes && <p className="text-sm mt-1">{visit.notes}</p>}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
