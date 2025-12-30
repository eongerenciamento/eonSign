import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, X, FileVideo, Image as ImageIcon, Plus, Check } from "lucide-react";

const ticketFormSchema = z.object({
  title: z
    .string()
    .min(5, "O título deve ter no mínimo 5 caracteres")
    .max(100, "O título deve ter no máximo 100 caracteres"),
  category: z.string().min(1, "Selecione uma categoria"),
  priority: z.string().min(1, "Selecione uma prioridade"),
  description: z
    .string()
    .min(20, "A descrição deve ter no mínimo 20 caracteres")
    .max(1000, "A descrição deve ter no máximo 1000 caracteres"),
});

type TicketFormValues = z.infer<typeof ticketFormSchema>;

interface CreateTicketSheetProps {
  onTicketCreated?: () => void;
}

export function CreateTicketSheet({ onTicketCreated }: CreateTicketSheetProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  const form = useForm<TicketFormValues>({
    resolver: zodResolver(ticketFormSchema),
    defaultValues: {
      title: "",
      category: "",
      priority: "",
      description: "",
    },
  });

  const generateTempId = () => {
    return crypto.randomUUID();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter((file) => {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      const isUnder20MB = file.size <= 20 * 1024 * 1024; // 20MB limit

      if (!isImage && !isVideo) {
        toast.error(`${file.name} não é uma imagem ou vídeo válido`);
        return false;
      }
      if (!isUnder20MB) {
        toast.error(`${file.name} excede o limite de 20MB`);
        return false;
      }
      return true;
    });

    if (validFiles.length + uploadedFiles.length > 10) {
      toast.error("Máximo de 10 arquivos permitido");
      return;
    }

    setUploadedFiles((prev) => [...prev, ...validFiles]);

    // Generate preview URLs
    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrls((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });

    // Clear input to allow re-selecting the same file
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFilesToStorage = async (userId: string, ticketNumber: string) => {
    const uploadedPaths: string[] = [];
    // Sanitize ticket number for file path (remove # and special chars)
    const sanitizedTicketNumber = ticketNumber.replace(/[^a-zA-Z0-9-]/g, '');

    for (const file of uploadedFiles) {
      const fileExt = file.name.split(".").pop();
      // Use UUID to guarantee unique file names
      const uniqueId = crypto.randomUUID();
      const fileName = `${sanitizedTicketNumber}-${uniqueId}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      let uploadError = null;
      
      // Try upload
      const { error } = await supabase.storage.from("support-attachments").upload(filePath, file);
      
      if (error) {
        // If 409 (already exists), retry with new UUID
        if (error.message?.includes('already exists') || (error as any).statusCode === '409') {
          const retryUniqueId = crypto.randomUUID();
          const retryFileName = `${sanitizedTicketNumber}-${retryUniqueId}.${fileExt}`;
          const retryFilePath = `${userId}/${retryFileName}`;
          
          const { error: retryError } = await supabase.storage.from("support-attachments").upload(retryFilePath, file);
          
          if (retryError) {
            uploadError = retryError;
          } else {
            uploadedPaths.push(retryFilePath);
          }
        } else {
          uploadError = error;
        }
      } else {
        uploadedPaths.push(filePath);
      }

      if (uploadError) {
        console.error("Error uploading file:", uploadError);
        throw new Error(`Falha ao enviar ${file.name}`);
      }
    }

    return uploadedPaths;
  };

  const onSubmit = async (values: TicketFormValues) => {
    setIsSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Você precisa estar autenticado para abrir um ticket");
        return;
      }

      // Upload files to storage first (using temporary ticket number for file names)
      const tempTicketNumber = `TEMP-${Date.now()}`;
      
      let attachmentPaths: string[] = [];
      if (uploadedFiles.length > 0) {
        try {
          attachmentPaths = await uploadFilesToStorage(user.id, tempTicketNumber);
        } catch (uploadError: any) {
          console.error("Upload error:", uploadError);
          toast.error(uploadError.message || "Falha ao enviar anexos. Tente novamente.");
          return;
        }
      }

      // Call Edge Function to create ticket and send webhook
      const { data, error } = await supabase.functions.invoke('create-ticket', {
        body: {
          title: values.title,
          category: values.category,
          priority: values.priority,
          description: values.description,
          attachmentPaths,
        },
      });

      if (error) throw error;

      toast.success("Ticket criado com sucesso!");
      form.reset();
      setUploadedFiles([]);
      setPreviewUrls([]);
      setOpen(false);
      onTicketCreated?.();
    } catch (error) {
      console.error("Erro ao criar ticket:", error);
      toast.error("Erro ao criar ticket. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="bg-gray-100 text-gray-700 hover:bg-gray-100 hover:text-gray-700 font-normal rounded-full">
          <Plus className="w-4 h-4 mr-2" />
          Novo ticket
        </Button>
      </SheetTrigger>
      <SheetContent
        className="w-full sm:max-w-[540px] overflow-y-auto rounded-l-2xl"
      >
        <SheetHeader>
          <SheetTitle className="text-sm text-gray-600">Abrir Novo Ticket</SheetTitle>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-600">Título</FormLabel>
                  <FormControl>
                    <Input placeholder="Descreva brevemente o problema" className="bg-gray-100 border-0 text-gray-600 placeholder:text-gray-500" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-600">Categoria</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-gray-100 border-0 text-gray-600 placeholder:text-gray-500">
                          <SelectValue placeholder="Selecione" className="text-gray-500" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-background z-[100]">
                        <SelectItem value="sugestao">Sugestão</SelectItem>
                        <SelectItem value="tecnico">Técnico</SelectItem>
                        <SelectItem value="financeiro">Financeiro</SelectItem>
                        <SelectItem value="duvida">Dúvida</SelectItem>
                        <SelectItem value="outros">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-600">Prioridade</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-gray-100 border-0 text-gray-600 placeholder:text-gray-500">
                          <SelectValue placeholder="Selecione" className="text-gray-500" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-background z-[100]">
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="urgente">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-600">Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva o problema em detalhes..."
                      className="min-h-[150px] resize-none bg-gray-100 border-0 text-gray-600 placeholder:text-gray-500"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* File Upload Section */}
            <div className="space-y-3">
              <FormLabel className="text-gray-600">Anexos (Imagens e Vídeos)</FormLabel>
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                <input
                  type="file"
                  id="file-upload"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-gray-500" />
                  <p className="text-sm text-gray-500">Clique para selecionar arquivos</p>
                  <p className="text-xs text-gray-500">Máximo 10 arquivos, 20MB cada</p>
                </label>
              </div>

              {/* Preview uploaded files */}
              {uploadedFiles.length > 0 && (
                <div className="flex flex-col gap-2 mt-3">
                  {uploadedFiles.map((file, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between bg-gray-100 rounded-lg px-4 py-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {file.type.startsWith("image/") ? (
                          <ImageIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <FileVideo className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className="text-sm text-muted-foreground truncate">
                          {file.name}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="text-muted-foreground hover:text-foreground p-1 flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="ghost"
                className="flex-1 rounded-full text-gray-600 hover:bg-transparent hover:text-gray-600"
                onClick={() => {
                  setOpen(false);
                  form.reset();
                  setUploadedFiles([]);
                  setPreviewUrls([]);
                }}
                disabled={isSubmitting}
              >
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-100 hover:text-gray-700"
                disabled={isSubmitting}
              >
                <Check className="w-4 h-4 mr-2" />
                {isSubmitting ? "Criando..." : "Criar Ticket"}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
