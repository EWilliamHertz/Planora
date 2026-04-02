import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export function DeleteRecurringDialog({
  open,
  onClose,
  onSelect,
  eventTitle,
  eventDate,
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-rose-500" />
            <DialogTitle>Delete Recurring Event</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            <span className="font-medium text-foreground block mb-1">{eventTitle}</span>
            <span className="text-xs text-muted-foreground">on {eventDate}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <p className="text-sm text-muted-foreground">
            This is a recurring event. How would you like to delete it?
          </p>
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSelect("this")}
            className="text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/30"
          >
            Delete This Event
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onSelect("all")}
          >
            Delete All Events
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
