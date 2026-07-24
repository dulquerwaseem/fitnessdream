import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type ConfirmActionDialogProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  /** Financial impact banner shown above the action. */
  financialAmount?: string | null;
  /** If provided, user must type this value exactly to enable the button. */
  typeToConfirm?: string;
  /** Ask for an optional reason note. */
  askReason?: boolean;
  reasonLabel?: string;
  reasonRequired?: boolean;
  onConfirm: (reason?: string) => void | Promise<void>;
};

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = true,
  financialAmount = null,
  typeToConfirm,
  askReason = false,
  reasonLabel = "Reason (optional)",
  reasonRequired = false,
  onConfirm,
}: ConfirmActionDialogProps) {
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) { setTyped(""); setReason(""); setBusy(false); }
  }, [open]);

  const typedOk = !typeToConfirm || typed.trim() === typeToConfirm.trim();
  const reasonOk = !reasonRequired || reason.trim().length > 0;
  const canConfirm = typedOk && reasonOk && !busy;

  const handle = async () => {
    if (!canConfirm) return;
    setBusy(true);
    try {
      await onConfirm(reason.trim() || undefined);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {destructive && <AlertTriangle className="h-5 w-5 text-destructive" />}
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-line">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {financialAmount && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Financial impact</div>
            <div className="font-semibold text-destructive">{financialAmount}</div>
          </div>
        )}

        {typeToConfirm && (
          <div className="space-y-2">
            <Label className="text-xs">
              Type <span className="font-mono font-semibold">{typeToConfirm}</span> to confirm
            </Label>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={typeToConfirm}
              autoComplete="off"
            />
          </div>
        )}

        {askReason && (
          <div className="space-y-2">
            <Label className="text-xs">{reasonLabel}{reasonRequired && " *"}</Label>
            <Textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Duplicate entry, wrong member, etc."
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handle(); }}
            disabled={!canConfirm}
            className={destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
          >
            {busy ? "Working…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
