import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  imageUrl?: string | null;
  trigger: ReactNode;
}

export function LayoutPhotoDialog({ imageUrl, trigger }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <span onClick={() => imageUrl && setOpen(true)}>{trigger}</span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Layout photo</DialogTitle>
          </DialogHeader>
          {imageUrl && <img src={imageUrl} alt="Event layout" className="w-full rounded-md border border-border" />}
        </DialogContent>
      </Dialog>
    </>
  );
}
