import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { openWhatsApp } from "@/lib/phone";
import { toast } from "sonner";

type Props = {
  phone: string;
  message: string;
  memberId?: string | null;
  templateKey?: string;
  countryCode?: string;
  label?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "icon";
};

export function WhatsAppButton({
  phone,
  message,
  memberId,
  templateKey,
  countryCode = "91",
  label = "WhatsApp",
  variant = "outline",
  size = "sm",
}: Props) {
  const handleClick = async () => {
    if (!phone) {
      toast.error("No phone number on file");
      return;
    }
    openWhatsApp(phone, message, countryCode);
    if (memberId) {
      await supabase.from("messages_log").insert({
        member_id: memberId,
        channel: "whatsapp",
        template_key: templateKey ?? null,
        body: message,
      });
    }
  };
  return (
    <Button variant={variant} size={size} onClick={handleClick} className="gap-2">
      <MessageCircle className="h-4 w-4" />
      {label}
    </Button>
  );
}
