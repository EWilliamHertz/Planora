import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Share2,
  Download,
  Copy,
  Check,
  Code,
  Link2,
  CalendarDays,
  QrCode,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function SharePage() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(null);
  const cardRef = useRef(null);

  const bookingLink = `${window.location.origin}/book/${user?.user_id}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(bookingLink)}&bgcolor=1e1b4b&color=a5b4fc&format=png`;

  const embedCode = `<!-- Planora Booking Button -->
<a href="${bookingLink}" target="_blank" rel="noopener"
   style="display:inline-flex;align-items:center;gap:8px;padding:12px 24px;background:#6366f1;color:#fff;border-radius:12px;text-decoration:none;font-family:sans-serif;font-weight:600;font-size:14px;transition:opacity 0.2s">
  Book a meeting with ${user?.name || "me"}
</a>`;

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopied(null), 2000);
    }).catch(() => {
      toast.error("Failed to copy");
    });
  };

  const downloadCard = async () => {
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const w = 800;
      const h = 420;
      const dpr = 2;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);

      // Background
      ctx.fillStyle = "#1e1b4b";
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, 24);
      ctx.fill();

      // Subtle pattern overlay
      ctx.fillStyle = "rgba(99, 102, 241, 0.05)";
      for (let i = 0; i < w; i += 40) {
        for (let j = 0; j < h; j += 40) {
          ctx.beginPath();
          ctx.arc(i, j, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Left accent line
      ctx.fillStyle = "#6366f1";
      ctx.beginPath();
      ctx.roundRect(32, 40, 4, 80, 2);
      ctx.fill();

      // User name
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 36px Manrope, sans-serif";
      ctx.fillText(user?.name || "Your Name", 52, 80);

      // Tagline
      ctx.fillStyle = "#a5b4fc";
      ctx.font = "500 18px 'DM Sans', sans-serif";
      ctx.fillText("Schedule a meeting with me", 52, 115);

      // Description
      ctx.fillStyle = "#6366f1";
      ctx.font = "14px 'DM Sans', sans-serif";
      ctx.fillText("Scan the QR code or visit the link below", 52, 155);

      // QR Code
      const qrImg = new Image();
      qrImg.crossOrigin = "anonymous";
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(bookingLink)}&bgcolor=1e1b4b&color=e0e7ff&format=png`;

      await new Promise((resolve) => {
        qrImg.onload = resolve;
        qrImg.onerror = resolve;
        qrImg.src = qrUrl;
      });

      // QR background
      ctx.fillStyle = "rgba(99, 102, 241, 0.1)";
      ctx.beginPath();
      ctx.roundRect(w - 260, 40, 220, 220, 16);
      ctx.fill();

      // QR border
      ctx.strokeStyle = "rgba(165, 180, 252, 0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(w - 260, 40, 220, 220, 16);
      ctx.stroke();

      if (qrImg.complete && qrImg.naturalWidth > 0) {
        ctx.drawImage(qrImg, w - 250, 50, 200, 200);
      }

      // Divider line
      ctx.fillStyle = "rgba(99, 102, 241, 0.2)";
      ctx.fillRect(52, h - 120, w - 104, 1);

      // Booking URL
      ctx.fillStyle = "#c7d2fe";
      ctx.font = "500 14px 'DM Sans', sans-serif";
      ctx.fillText(bookingLink, 52, h - 75);

      // Planora branding
      ctx.fillStyle = "#818cf8";
      ctx.font = "bold 18px Manrope, sans-serif";
      ctx.fillText("Planora", 52, h - 35);

      ctx.fillStyle = "#6366f1";
      ctx.font = "13px 'DM Sans', sans-serif";
      ctx.fillText("Smart Scheduling & Task Planner", 130, h - 35);

      // Download
      const link = document.createElement("a");
      link.download = `planora-${(user?.name || "card").toLowerCase().replace(/\s+/g, "-")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Card downloaded!");
    } catch (e) {
      toast.error("Failed to download card");
      console.error(e);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 sm:p-8 animate-fadeIn" data-testid="share-page">
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-2">
          <Share2 className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Share Your Planora</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Generate a professional scheduling card with QR code. Share it in emails, LinkedIn, or print it.
        </p>
      </div>

      {/* Preview Card */}
      <div className="mb-8" ref={cardRef}>
        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 block">
          Card Preview
        </Label>
        <div className="relative overflow-hidden rounded-2xl bg-[#1e1b4b] p-8 sm:p-10 shadow-2xl">
          {/* Dot pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: "radial-gradient(circle, #6366f1 1px, transparent 1px)",
            backgroundSize: "32px 32px"
          }} />

          <div className="relative flex flex-col sm:flex-row items-start justify-between gap-8">
            {/* Left side */}
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-6">
                <Avatar className="h-14 w-14 ring-2 ring-indigo-400/30 ring-offset-2 ring-offset-[#1e1b4b]">
                  <AvatarImage src={user?.picture} className="object-cover" />
                  <AvatarFallback className="bg-indigo-600 text-white text-xl font-bold">
                    {user?.name?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">{user?.name}</h2>
                  <p className="text-indigo-300 text-sm font-medium">Schedule a meeting with me</p>
                </div>
              </div>

              <p className="text-indigo-400/80 text-sm mb-6">
                Scan the QR code or visit the link below to book a time slot that works for you.
              </p>

              {/* Booking URL pill */}
              <div className="inline-flex items-center gap-2 bg-indigo-900/50 border border-indigo-500/20 rounded-full px-4 py-2">
                <Link2 className="h-3.5 w-3.5 text-indigo-400" />
                <span className="text-indigo-200 text-xs font-mono truncate max-w-[280px]">{bookingLink}</span>
              </div>
            </div>

            {/* Right side - QR Code */}
            <div className="flex flex-col items-center gap-3">
              <div className="bg-indigo-900/40 border border-indigo-500/20 rounded-2xl p-4">
                <img
                  src={qrCodeUrl}
                  alt="QR Code"
                  className="w-[160px] h-[160px] rounded-lg"
                  data-testid="share-qr-code"
                />
              </div>
              <span className="text-indigo-400/60 text-[10px] uppercase tracking-widest font-medium">Scan to book</span>
            </div>
          </div>

          {/* Footer */}
          <div className="relative mt-8 pt-6 border-t border-indigo-500/10 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-indigo-400" />
            <span className="text-indigo-300 font-bold text-sm tracking-tight">Planora</span>
            <span className="text-indigo-500/60 text-xs">Smart Scheduling & Task Planner</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <Button
          data-testid="download-card-btn"
          size="lg"
          className="h-12 gap-2"
          onClick={downloadCard}
        >
          <Download className="h-4 w-4" />
          Download Card as PNG
        </Button>
        <Button
          data-testid="copy-booking-link-share-btn"
          variant="outline"
          size="lg"
          className="h-12 gap-2"
          onClick={() => handleCopy(bookingLink, "link")}
        >
          {copied === "link" ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
          Copy Booking Link
        </Button>
      </div>

      {/* Embed Code */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Code className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Embed Code
            </h3>
          </div>
          <Button
            data-testid="copy-embed-btn"
            variant="outline"
            size="sm"
            onClick={() => handleCopy(embedCode, "embed")}
          >
            {copied === "embed" ? <Check className="h-3.5 w-3.5 mr-1 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
            Copy
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Add this HTML snippet to your website, email signature, or blog.
        </p>
        <div className="bg-muted/50 rounded-lg p-4 overflow-x-auto">
          <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap break-all">
            {embedCode}
          </pre>
        </div>

        {/* Preview of embed button */}
        <div className="mt-4 pt-4 border-t border-border">
          <Label className="text-xs text-muted-foreground mb-2 block">Preview:</Label>
          <a
            href={bookingLink}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="embed-preview-btn"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            <CalendarDays className="h-4 w-4" />
            Book a meeting with {user?.name || "me"}
          </a>
        </div>
      </div>
    </div>
  );
}
