import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { Attendance } from "@bip/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useRevalidator } from "react-router-dom";
import { toast } from "sonner";

interface AttendanceData {
  attendances: Attendance[];
}

interface Props {
  showId: string;
  initialAttendance: Attendance | null;
}

export function AttendanceToggle({ showId, initialAttendance }: Props) {
  const [isAttending, setIsAttending] = useState(!!initialAttendance);
  const [currentAttendance, setCurrentAttendance] = useState<Attendance | null>(initialAttendance);
  const queryClient = useQueryClient();
  const revalidator = useRevalidator();

  // Keep currentAttendance and isAttending in sync with initialAttendance
  useEffect(() => {
    setCurrentAttendance(initialAttendance);
    setIsAttending(!!initialAttendance);
  }, [initialAttendance]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/attendances", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ showId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create attendance");
      }

      return response.json();
    },
    onMutate: () => {
      // Optimistically update
      setIsAttending(true);
      toast.loading("Marking attendance...");
    },
    onSuccess: (data) => {
      toast.dismiss();
      toast.success("Attendance marked! 🎵");
      setCurrentAttendance(data.attendance);
      setIsAttending(true);
      queryClient.setQueryData(["attendances", showId], (old: AttendanceData | undefined) => {
        const oldAttendances = old?.attendances || [];
        return {
          attendances: [...oldAttendances, data.attendance],
        };
      });
      // Also invalidate any queries that might be loading this data
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      // Force a revalidation of the current route data
      revalidator.revalidate();
    },
    onError: (error) => {
      toast.dismiss();
      toast.error(`Failed to mark attendance: ${error.message}`);
      setIsAttending(false);
      setCurrentAttendance(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (attendanceId: string) => {
      if (!attendanceId) {
        throw new Error("No attendance ID for deletion");
      }

      const response = await fetch("/api/attendances", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: attendanceId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete attendance");
      }

      return { deletedId: attendanceId };
    },
    onMutate: (attendanceId) => {
      const previousAttendance = currentAttendance;
      // Optimistically update
      setIsAttending(false);
      setCurrentAttendance(null);
      toast.loading("Removing attendance...");
      return { previousAttendance };
    },
    onError: (error, variables, context) => {
      toast.dismiss();
      toast.error(`Failed to remove attendance: ${error.message}`);
      // Revert optimistic update
      if (context?.previousAttendance) {
        setCurrentAttendance(context.previousAttendance);
        setIsAttending(true);
      }
    },
    onSuccess: (result) => {
      toast.dismiss();
      toast.success("Attendance removed");
      setIsAttending(false);
      setCurrentAttendance(null);
      queryClient.setQueryData(["attendances", showId], (old: AttendanceData | undefined) => {
        const oldAttendances = old?.attendances || [];
        return {
          attendances: oldAttendances.filter((a) => a.id !== result.deletedId),
        };
      });
      // Also invalidate any queries that might be loading this data
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      // Force a revalidation of the current route data
      revalidator.revalidate();
    },
  });

  const handleToggle = (checked: boolean) => {
    if (checked) {
      createMutation.mutate();
    } else if (currentAttendance?.id) {
      deleteMutation.mutate(currentAttendance.id);
    } else {
      setIsAttending(false);
      setCurrentAttendance(null);
    }
  };

  const switchId = `attendance-switch-${showId}`;

  return (
    <div className="flex items-center gap-2">
      <Switch
        id={switchId}
        checked={isAttending}
        onCheckedChange={handleToggle}
        disabled={createMutation.isPending || deleteMutation.isPending}
        className={cn(
          "h-5 w-9",
          "data-[state=checked]:bg-brand",
          "data-[state=unchecked]:bg-brand/50",
          "[&>span]:h-4 [&>span]:w-4",
          "[&>span]:data-[state=checked]:bg-white",
          "[&>span]:data-[state=unchecked]:bg-white",
          "[&>span]:data-[state=checked]:shadow-[0_0_12px_rgba(107,33,168,0.5)]",
        )}
      />
      <label htmlFor={switchId} className="text-sm font-medium leading-none text-content-text-secondary">
        Saw it?
      </label>
    </div>
  );
}
