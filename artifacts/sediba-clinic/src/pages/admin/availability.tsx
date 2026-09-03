import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAdminGetAvailability,
  getAdminGetAvailabilityQueryKey,
  useAdminAddAvailabilitySlots,
  useAdminRemoveAvailabilitySlot,
  useAdminClearAvailabilityDate,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Plus, CalendarX2 } from "lucide-react";

const QUICK_TIMES = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00",
];

export default function AdminAvailability() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [visibleMonth, setVisibleMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [customTime, setCustomTime] = useState("");

  const monthStr = format(visibleMonth, "yyyy-MM");
  const params = { month: monthStr };
  const { data: days, isLoading } = useAdminGetAvailability(params, {
    query: {
      queryKey: getAdminGetAvailabilityQueryKey(params),
      refetchOnWindowFocus: "always",
    },
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: getAdminGetAvailabilityQueryKey(params) });

  const addSlots = useAdminAddAvailabilitySlots();
  const removeSlot = useAdminRemoveAvailabilitySlot();
  const clearDate = useAdminClearAvailabilityDate();

  const dateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
  const dayMap = useMemo(() => new Map((days ?? []).map((d) => [d.date, d.slots])), [days]);
  const selectedSlots = dayMap.get(dateStr) ?? [];
  const configuredTimes = new Set(selectedSlots.map((s) => s.time));

  const handleAdd = (times: string[]) => {
    if (!dateStr || times.length === 0) return;
    addSlots.mutate(
      { data: { date: dateStr, times } },
      {
        onSuccess: () => {
          refresh();
          setCustomTime("");
        },
        onError: () =>
          toast({ title: "Could not add slots", description: "Use HH:MM 24-hour format, e.g. 09:30.", variant: "destructive" }),
      }
    );
  };

  const handleRemove = (time: string) => {
    removeSlot.mutate(
      { params: { date: dateStr, time } },
      {
        onSuccess: () => refresh(),
        onError: () =>
          toast({
            title: "Slot is booked",
            description: "This slot has a booked appointment. Cancel the appointment first.",
            variant: "destructive",
          }),
      }
    );
  };

  const handleClearDate = () => {
    clearDate.mutate(
      { date: dateStr },
      {
        onSuccess: (res) => {
          refresh();
          toast({
            title: "Date cleared",
            description:
              res.bookedRemaining > 0
                ? `${res.removed} open slot(s) removed. ${res.bookedRemaining} booked slot(s) remain — cancel those appointments to free them.`
                : `${res.removed} slot(s) removed. This date is no longer bookable.`,
          });
        },
      }
    );
  };

  return (
    <div className="p-6 md:p-10 max-w-6xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-foreground mb-2">Availability</h1>
        <p className="text-muted-foreground text-sm">
          Choose a date, then add the times clients can book. Dates without any times are not
          bookable on the website. Changes go live immediately.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 items-start">
        {/* Calendar */}
        <div className="bg-card border border-border p-6">
          <Label className="uppercase tracking-widest text-[10px] text-muted-foreground mb-4 block">
            Select a date to manage
          </Label>
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              month={visibleMonth}
              onMonthChange={setVisibleMonth}
              onSelect={(d) => {
                setSelectedDate(d);
                // Bookings can happen in another tab at any time — refetch so
                // booked badges are always current when a date is opened.
                refresh();
              }}
              modifiers={{
                hasSlots: (d: Date) => dayMap.has(format(d, "yyyy-MM-dd")),
              }}
              modifiersClassNames={{
                hasSlots: "font-semibold [&>button]:bg-primary/15 [&>button]:hover:bg-primary/25",
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Highlighted dates already have time slots configured{isLoading ? " (loading…)" : ""}.
          </p>
        </div>

        {/* Slot editor */}
        <div className="bg-card border border-border p-6">
          {!selectedDate ? (
            <p className="text-sm text-muted-foreground">Select a date on the calendar.</p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-serif text-xl text-foreground">
                  {format(selectedDate, "EEEE, d MMMM yyyy")}
                </h2>
                {selectedSlots.some((s) => !s.booked) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearDate}
                    disabled={clearDate.isPending}
                    className="rounded-none text-xs uppercase tracking-widest border-destructive/40 text-destructive hover:bg-destructive/10"
                  >
                    <CalendarX2 className="w-3.5 h-3.5 mr-2" />
                    Clear open slots
                  </Button>
                )}
              </div>

              {/* Configured slots */}
              <Label className="uppercase tracking-widest text-[10px] text-muted-foreground mb-3 block">
                Bookable times ({selectedSlots.length})
              </Label>
              {selectedSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground border border-dashed border-border p-4 mb-6">
                  No times configured. This date is not bookable by clients.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 mb-6">
                  {selectedSlots.map((slot) => (
                    <span
                      key={slot.time}
                      className={`inline-flex items-center gap-2 border px-3 py-2 text-sm ${
                        slot.booked
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-foreground pr-1"
                      }`}
                    >
                      {slot.time}
                      {slot.booked ? (
                        <span className="text-[10px] uppercase tracking-widest text-primary">Booked</span>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Remove ${slot.time}`}
                          onClick={() => handleRemove(slot.time)}
                          disabled={removeSlot.isPending}
                          className="text-muted-foreground hover:text-destructive transition-colors p-2"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}

              {/* Quick add */}
              <Label className="uppercase tracking-widest text-[10px] text-muted-foreground mb-3 block">
                Add times
              </Label>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 mb-4">
                {QUICK_TIMES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    disabled={configuredTimes.has(t) || addSlots.isPending}
                    onClick={() => handleAdd([t])}
                    className={`py-3 px-1 text-sm border transition-colors ${
                      configuredTimes.has(t)
                        ? "border-transparent bg-muted/50 text-muted-foreground/50 cursor-not-allowed"
                        : "border-border text-foreground hover:border-primary hover:text-primary"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  placeholder="Custom time, e.g. 18:15"
                  className="rounded-none border-border h-10"
                />
                <Button
                  onClick={() => handleAdd([customTime.trim()])}
                  disabled={!/^([01]\d|2[0-3]):[0-5]\d$/.test(customTime.trim()) || addSlots.isPending}
                  className="rounded-none uppercase tracking-widest text-xs px-6"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
