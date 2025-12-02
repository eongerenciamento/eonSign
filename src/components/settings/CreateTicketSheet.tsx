import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, X, FileVideo, Image as ImageIcon } from "lucide-react";

const ticketFormSchema = z.object({
  title: z.string().min(5, "O título deve ter no mínimo 5 caracteres").max(100, "O título deve ter no máximo 100 caracteres"),
  category: z.string().min(1, "Selecione uma categoria"),
  priority: z.string().min(1, "Selecione uma prioridade"),
  description: z.string().min(20, "A descrição deve ter no mínimo 20 caracteres").max(1000, "A descrição deve ter no máximo 1000 caracteres"),
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

  const generateTicketNumber = () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `#${timestamp}${random}`;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
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

    setUploadedFiles(prev => [...prev, ...validFiles]);

    // Generate preview URLs
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrls(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFilesToStorage = async (userId: string, ticketNumber: string) => {
    const uploadedPaths: string[] = [];

    for (const file of uploadedFiles) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${ticketNumber}-${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { error } = await supabase.storage
        .from('support-attachments')
        .upload(filePath, file);

      if (error) {
        console.error('Error uploading file:', error);
        toast.error(`Erro ao enviar ${file.name}`);
      } else {
        uploadedPaths.push(filePath);
      }
    }

    return uploadedPaths;
  };

  const onSubmit = async (values: TicketFormValues) => {
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Você precisa estar autenticado para abrir um ticket");
        return;
      }

      const ticketNumber = generateTicketNumber();

      // Upload files to storage
      const attachmentPaths = await uploadFilesToStorage(user.id, ticketNumber);

      const fullDescription = `Categoria: ${values.category}\nPrioridade: ${values.priority}\n\n${values.description}${
        attachmentPaths.length > 0 ? `\n\nAnexos: ${attachmentPaths.length}` : ''
      }`;

      const { error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user.id,
          title: values.title,
          description: fullDescription,
          ticket_number: ticketNumber,
          status: 'aberto',
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
        <Button className="bg-gradient-to-r from-[#273d60] to-[#001f3f] text-white hover:opacity-90 font-normal rounded-full">
          Abrir Novo Ticket
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-[540px] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
        <SheetHeader>
          <SheetTitle>Abrir Novo Ticket</SheetTitle>
          <SheetDescription>
            Preencha o formulário abaixo para abrir um ticket de suporte. Nossa equipe responderá em breve.
          </SheetDescription>
        </SheetHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input placeholder="Descreva brevemente o problema" {...field} />
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
                    <FormLabel>Categoria</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-background z-[100]">
                        <SelectItem value="tecnico">Técnico</SelectItem>
                        <SelectItem value="financeiro">Financeiro</SelectItem>
                        <SelectItem value="duvida">Dúvida</SelectItem>
                        <SelectItem value="sugestao">Sugestão</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
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
                    <FormLabel>Prioridade</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-background z-[100]">
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
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
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Descreva o problema em detalhes..."
                      className="min-h-[150px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* File Upload Section */}
            <div className="space-y-3">
              <FormLabel>Anexos (Imagens e Vídeos)</FormLabel>
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
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Clique para selecionar arquivos
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Máximo 10 arquivos, 20MB cada
                  </p>
                </label>
              </div>

              {/* Preview uploaded files */}
              {uploadedFiles.length > 0 && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="relative group rounded-lg overflow-hidden border border-border">
                      {file.type.startsWith('image/') ? (
                        <div className="relative aspect-video bg-muted">
                          <img
                            src={previewUrls[index]}
                            alt={file.name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                            <ImageIcon className="w-3 h-3" />
                            Imagem
                          </div>
                        </div>
                      ) : (
                        <div className="aspect-video bg-muted flex flex-col items-center justify-center">
                          <FileVideo className="w-8 h-8 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground mt-2">Vídeo</p>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <p className="text-xs p-2 truncate">{file.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setOpen(false);
                  form.reset();
                  setUploadedFiles([]);
                  setPreviewUrls([]);
                }}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-[#273d60] to-[#001f3f] text-white hover:opacity-90"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Criando..." : "Criar Ticket"}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
