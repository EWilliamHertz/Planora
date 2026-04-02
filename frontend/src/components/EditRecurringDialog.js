import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";

export function EditRecurringDialog({ open, onClose, onSelect, eventTitle, eventDate }) {
  const [selectedOption, setSelectedOption] = useState("this");

  const handleConfirm = () => {
    onSelect(selectedOption);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Repeat className="h-5 w-5 text-amber-600" />
            <DialogTitle>Edit Recurring Event</DialogTitle>
          </div>
          <DialogDescription>
            This event repeats. How would you like to edit it?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {/* This Event Only */}
          <div
            className={cn(
              "p-4 border-2 rounded-lg cursor-pointer transition-colors",
              selectedOption === "this"
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                : "border-border hover:bg-accent"
            )}
            onClick={() => setSelectedOption("this")}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="scope"
                value="this"
                checked={selectedOption === "this"}
                onChange={(e) => setSelectedOption(e.target.value)}
                className="mt-1"
              />
              <div className="flex-1">
                <h4 className="font-semibold text-sm">This event only</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Changes apply to {eventDate || "this instance"} only. Other occurrences remain unchanged.
                </p>
              </div>
            </div>
          </div>

          {/* All Events */}
          <div
            className={cn(
              "p-4 border-2 rounded-lg cursor-pointer transition-colors",
              selectedOption === "all"
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                : "border-border hover:bg-accent"
            )}
            onClick={() => setSelectedOption("all")}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="scope"
                value="all"
                checked={selectedOption === "all"}
                onChange={(e) => setSelectedOption(e.target.value)}
                className="mt-1"
              />
              <div className="flex-1">
                <h4 className="font-semibold text-sm">All events</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Changes apply to all occurrences of this recurring event.
                </p>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              You can always edit individual instances later, even for "All events" changes.
            </p>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleConfirm}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
