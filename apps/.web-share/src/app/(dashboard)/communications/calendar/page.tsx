'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Sparkles,
  Loader2,
  MoreVertical,
  Pencil,
  Trash2,
  MapPin,
  Clock,
  AlertCircle,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { communicationsApi } from '@/lib/api';
import { toast } from 'sonner';

interface EventType {
  code: string;
  name: string;
  color: string;
  isActive: boolean;
}

interface Event {
  _id: string;
  title: string;
  description?: string;
  type: string;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  location?: string;
  status: 'scheduled' | 'cancelled' | 'completed';
  createdAt: string;
}

interface EventForm {
  title: string;
  description: string;
  type: string;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  location: string;
}

const DEFAULT_EVENT_FORM: EventForm = {
  title: '',
  description: '',
  type: '',
  startDate: '',
  endDate: '',
  isAllDay: true,
  location: '',
};

const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialog states
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [eventForm, setEventForm] = useState<EventForm>(DEFAULT_EVENT_FORM);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState<Event[]>([]);
  const [dayEventsDialogOpen, setDayEventsDialogOpen] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Fetch events and event types
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [eventsResponse, settingsResponse] = await Promise.all([
        communicationsApi.getCalendarEvents({ month: month + 1, year }),
        communicationsApi.getSettings(),
      ]);

      if (eventsResponse.success) {
        setEvents(eventsResponse.data || []);
      }
      if (settingsResponse.success) {
        setEventTypes(settingsResponse.data.eventTypes?.filter((t: EventType) => t.isActive) || []);
      }
    } catch (err) {
      console.error('Failed to fetch calendar data:', err);
      toast.error('Failed to load calendar');
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getEventsForDate = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter((e) => {
      const startDate = e.startDate.split('T')[0];
      const endDate = e.endDate.split('T')[0];
      return dateStr >= startDate && dateStr <= endDate;
    });
  };

  const getEventTypeColor = (typeCode: string) => {
    const eventType = eventTypes.find((t) => t.code === typeCode);
    return eventType?.color || '#6B7280';
  };

  const getEventTypeName = (typeCode: string) => {
    const eventType = eventTypes.find((t) => t.code === typeCode);
    return eventType?.name || typeCode;
  };

  const handleOpenEventDialog = (event?: Event, date?: string) => {
    if (event) {
      setEditingEvent(event);
      setEventForm({
        title: event.title,
        description: event.description || '',
        type: event.type,
        startDate: event.startDate.split('T')[0],
        endDate: event.endDate.split('T')[0],
        isAllDay: event.isAllDay,
        location: event.location || '',
      });
    } else {
      setEditingEvent(null);
      const defaultDate = date || new Date().toISOString().split('T')[0];
      setEventForm({
        ...DEFAULT_EVENT_FORM,
        startDate: defaultDate,
        endDate: defaultDate,
        type: eventTypes[0]?.code || '',
      });
    }
    setEventDialogOpen(true);
  };

  const handleSaveEvent = async () => {
    if (!eventForm.title || !eventForm.type || !eventForm.startDate || !eventForm.endDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (new Date(eventForm.endDate) < new Date(eventForm.startDate)) {
      toast.error('End date cannot be before start date');
      return;
    }

    try {
      setSaving(true);
      if (editingEvent) {
        await communicationsApi.updateEvent(editingEvent._id, {
          title: eventForm.title,
          description: eventForm.description || undefined,
          type: eventForm.type,
          startDate: eventForm.startDate,
          endDate: eventForm.endDate,
          isAllDay: eventForm.isAllDay,
          location: eventForm.location || undefined,
        });
        toast.success('Event updated successfully');
      } else {
        await communicationsApi.createEvent({
          title: eventForm.title,
          description: eventForm.description || undefined,
          type: eventForm.type,
          startDate: eventForm.startDate,
          endDate: eventForm.endDate,
          isAllDay: eventForm.isAllDay,
          location: eventForm.location || undefined,
        });
        toast.success('Event created successfully');
      }
      setEventDialogOpen(false);
      setEditingEvent(null);
      setEventForm(DEFAULT_EVENT_FORM);
      fetchData();
    } catch (err) {
      console.error('Failed to save event:', err);
      toast.error('Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!deletingEventId) return;

    try {
      setSaving(true);
      await communicationsApi.deleteEvent(deletingEventId);
      toast.success('Event deleted successfully');
      setDeleteDialogOpen(false);
      setDeletingEventId(null);
      setDayEventsDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error('Failed to delete event:', err);
      toast.error('Failed to delete event');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEvent = async (eventId: string) => {
    try {
      await communicationsApi.cancelEvent(eventId);
      toast.success('Event cancelled');
      fetchData();
    } catch (err) {
      console.error('Failed to cancel event:', err);
      toast.error('Failed to cancel event');
    }
  };

  const handleDayClick = (day: number, dayEvents: Event[]) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(dateStr);

    if (dayEvents.length > 0) {
      setSelectedDayEvents(dayEvents);
      setDayEventsDialogOpen(true);
    } else {
      // Open create dialog with this date
      handleOpenEventDialog(undefined, dateStr);
    }
  };

  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const upcomingEvents = events
    .filter((e) => new Date(e.startDate) >= new Date() && e.status !== 'cancelled')
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Academic Calendar</h1>
          <p className="text-muted-foreground mt-1">View and manage school events and holidays</p>
        </div>
        <Button
          onClick={() => handleOpenEventDialog()}
          className="gap-2 bg-primary hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add Event
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendar */}
        <Card className="lg:col-span-2 border-0 shadow-elegant-md">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-xl">
              {months[month]} {year}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToToday}>
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={prevMonth} className="h-9 w-9">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={nextMonth} className="h-9 w-9">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Legend */}
            {eventTypes.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-4 pb-4 border-b">
                {eventTypes.map((type) => (
                  <div key={type.code} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: type.color }} />
                    <span className="text-muted-foreground">{type.name}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-7 gap-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div
                  key={day}
                  className="p-3 text-center text-sm font-semibold text-muted-foreground uppercase tracking-wider"
                >
                  {day}
                </div>
              ))}
              {days.map((day, idx) => {
                const dayEvents = day ? getEventsForDate(day) : [];
                const isToday =
                  day === new Date().getDate() &&
                  month === new Date().getMonth() &&
                  year === new Date().getFullYear();
                const dateStr = day
                  ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  : null;
                const isSelected = dateStr === selectedDate;

                return (
                  <div
                    key={idx}
                    onClick={() => day && handleDayClick(day, dayEvents)}
                    className={cn(
                      'min-h-24 p-2 border rounded-xl cursor-pointer transition-all duration-200',
                      day && 'hover:bg-muted/50 hover:border-primary/30',
                      isToday && 'border-primary bg-primary/5',
                      isSelected && 'ring-2 ring-primary ring-offset-2',
                      !day && 'bg-muted/10 cursor-default'
                    )}
                  >
                    {day && (
                      <>
                        <span
                          className={cn(
                            'inline-flex items-center justify-center h-7 w-7 rounded-full text-sm font-medium',
                            isToday && 'bg-primary text-primary-foreground'
                          )}
                        >
                          {day}
                        </span>
                        <div className="mt-1 space-y-1">
                          {dayEvents.slice(0, 2).map((event) => (
                            <div
                              key={event._id}
                              className={cn(
                                'text-xs px-2 py-1 rounded-md truncate font-medium',
                                event.status === 'cancelled' && 'line-through opacity-50'
                              )}
                              style={{
                                backgroundColor: `${getEventTypeColor(event.type)}20`,
                                color: getEventTypeColor(event.type),
                              }}
                            >
                              {event.title}
                            </div>
                          ))}
                          {dayEvents.length > 2 && (
                            <p className="text-xs text-muted-foreground px-2">
                              +{dayEvents.length - 2} more
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card className="border-0 shadow-elegant-md">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              <CardTitle className="text-xl">Upcoming Events</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {upcomingEvents.length === 0 ? (
              <div className="text-center py-8">
                <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No upcoming events</p>
                <Button variant="link" onClick={() => handleOpenEventDialog()} className="mt-2">
                  Create your first event
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingEvents.map((event, index) => (
                  <div
                    key={event._id}
                    className="flex items-start gap-4 p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors group"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div
                      className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${getEventTypeColor(event.type)}20` }}
                    >
                      <CalendarIcon
                        className="h-5 w-5"
                        style={{ color: getEventTypeColor(event.type) }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium group-hover:text-primary transition-colors">
                        {event.title}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(event.startDate).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                      {event.location && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {event.location}
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenEventDialog(event)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setDeletingEventId(event._id);
                            setDeleteDialogOpen(true);
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Event Dialog */}
      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Edit Event' : 'Create Event'}</DialogTitle>
            <DialogDescription>
              {editingEvent ? 'Update the event details' : 'Add a new event to the calendar'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={eventForm.title}
                onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                placeholder="Event title"
              />
            </div>

            <div className="space-y-2">
              <Label>Event Type *</Label>
              <Select
                value={eventForm.type}
                onValueChange={(v) => setEventForm({ ...eventForm, type: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
                <SelectContent>
                  {eventTypes.map((type) => (
                    <SelectItem key={type.code} value={type.code}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: type.color }}
                        />
                        {type.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {eventTypes.length === 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  No event types configured. Go to Settings to add event types.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <DatePicker
                  value={eventForm.startDate}
                  onChange={(iso) => setEventForm({ ...eventForm, startDate: iso })}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date *</Label>
                <DatePicker
                  value={eventForm.endDate}
                  onChange={(iso) => setEventForm({ ...eventForm, endDate: iso })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>All Day Event</Label>
                <p className="text-xs text-muted-foreground">Event spans the entire day(s)</p>
              </div>
              <Switch
                checked={eventForm.isAllDay}
                onCheckedChange={(checked) => setEventForm({ ...eventForm, isAllDay: checked })}
              />
            </div>

            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={eventForm.location}
                onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                placeholder="Event location (optional)"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={eventForm.description}
                onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                placeholder="Event description (optional)"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setEventDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEvent} disabled={saving || eventTypes.length === 0}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingEvent ? 'Update' : 'Create'} Event
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Day Events Dialog */}
      <Dialog open={dayEventsDialogOpen} onOpenChange={setDayEventsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Events on{' '}
              {selectedDate &&
                new Date(selectedDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
            </DialogTitle>
            <DialogDescription>
              {selectedDayEvents.length} event{selectedDayEvents.length !== 1 ? 's' : ''} scheduled
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {selectedDayEvents.map((event) => (
              <div
                key={event._id}
                className={cn(
                  'p-4 rounded-lg border bg-muted/30',
                  event.status === 'cancelled' && 'opacity-50'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getEventTypeColor(event.type) }}
                      />
                      <h4
                        className={cn(
                          'font-medium',
                          event.status === 'cancelled' && 'line-through'
                        )}
                      >
                        {event.title}
                      </h4>
                      {event.status === 'cancelled' && (
                        <Badge variant="secondary" className="text-xs">
                          Cancelled
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {getEventTypeName(event.type)}
                    </p>
                    {event.description && (
                      <p className="text-sm text-muted-foreground mt-2">{event.description}</p>
                    )}
                    {event.location && (
                      <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {event.location}
                      </p>
                    )}
                    {!event.isAllDay && (
                      <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(event.startDate).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                        {' - '}
                        {new Date(event.endDate).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    )}
                  </div>
                  {event.status !== 'cancelled' && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setDayEventsDialogOpen(false);
                            handleOpenEventDialog(event);
                          }}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCancelEvent(event._id)}>
                          <X className="h-4 w-4 mr-2" />
                          Cancel Event
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setDeletingEventId(event._id);
                            setDeleteDialogOpen(true);
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setDayEventsDialogOpen(false);
                handleOpenEventDialog(undefined, selectedDate || undefined);
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Event
            </Button>
            <Button variant="outline" onClick={() => setDayEventsDialogOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this event? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEvent}
              className="bg-destructive hover:bg-destructive/90"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
