import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Mic, Plus } from "lucide-react";

interface StartRecordingDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onStartNew: () => void;
    onContinue: () => void;
    existingTitle: string;
}

export function StartRecordingDialog({
    open,
    onOpenChange,
    onStartNew,
    onContinue,
    existingTitle,
}: StartRecordingDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Start Recording</DialogTitle>
                    <DialogDescription>
                        Would you like to start a brand new recording or add a new part to the currently selected one?
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 min-w-0">
                        <div className="text-sm font-medium text-zinc-100 mb-1">Selected Recording</div>
                        <div className="text-xs text-zinc-500 truncate">{existingTitle}</div>
                    </div>
                </div>

                <DialogFooter className="flex sm:justify-between gap-2">
                    <Button variant="outline" onClick={onStartNew} className="gap-2">
                        <Plus className="w-4 h-4" /> Start New
                    </Button>
                    <Button onClick={onContinue} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                        <Mic className="w-4 h-4" /> Continue
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
