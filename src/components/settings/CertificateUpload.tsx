import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Shield, ShieldCheck, ShieldAlert, Trash2, Loader2, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { parsePfxCertificate, CertificateMetadata } from "@/lib/certificate-parser";
import { format, differenceInDays, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CertificateUploadProps {
  userId: string;
  certificateData: {
    certificate_file_url: string | null;
    certificate_subject: string | null;
    certificate_issuer: string | null;
    certificate_valid_from: string | null;
    certificate_valid_to: string | null;
    certificate_serial_number: string | null;
    certificate_uploaded_at: string | null;
  } | null;
  onCertificateChange: () => void;
}

export function CertificateUpload({ userId, certificateData, onCertificateChange }: CertificateUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [parsedMetadata, setParsedMetadata] = useState<CertificateMetadata | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasCertificate = certificateData?.certificate_file_url;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (extension !== 'pfx' && extension !== 'p12') {
        toast.error("Arquivo inválido. Selecione um arquivo .pfx ou .p12");
        return;
      }
      setSelectedFile(file);
      setParsedMetadata(null);
      setParseError(null);
    }
  };

  // Simple XOR-based encryption (matches edge function decryption)
  const encryptPassword = (plainPassword: string, key: string): string => {
    const keyClean = key.replace(/-/g, '').substring(0, 32);
    const encoder = new TextEncoder();
    const passwordBytes = encoder.encode(plainPassword);
    
    const encrypted = new Uint8Array(passwordBytes.length);
    for (let i = 0; i < passwordBytes.length; i++) {
      encrypted[i] = passwordBytes[i] ^ keyClean.charCodeAt(i % keyClean.length);
    }
    
    return btoa(String.fromCharCode(...encrypted));
  };

  const handleParseAndUpload = async () => {
    if (!selectedFile) {
      toast.error("Selecione um arquivo de certificado");
      return;
    }
    if (!password) {
      toast.error("Digite a senha do certificado");
      return;
    }

    setIsUploading(true);
    setParseError(null);

    try {
      // Parse certificate to extract metadata
      const metadata = await parsePfxCertificate(selectedFile, password);
      setParsedMetadata(metadata);

      // Check if certificate is expired
      if (isPast(metadata.validTo)) {
        toast.error("Este certificado está expirado");
        setParseError("Certificado expirado");
        setIsUploading(false);
        return;
      }

      // Upload file to storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${userId}/certificate_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('certificates')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Encrypt password for secure storage
      const encryptedPassword = encryptPassword(password, userId);

      // Update company_settings with certificate metadata and encrypted password
      const { error: updateError } = await supabase
        .from('company_settings')
        .update({
          certificate_file_url: fileName,
          certificate_subject: metadata.subject,
          certificate_issuer: metadata.issuer,
          certificate_valid_from: metadata.validFrom.toISOString(),
          certificate_valid_to: metadata.validTo.toISOString(),
          certificate_serial_number: metadata.serialNumber,
          certificate_uploaded_at: new Date().toISOString(),
          certificate_password_encrypted: encryptedPassword,
        })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      toast.success("Certificado instalado com sucesso!");
      setSelectedFile(null);
      setPassword("");
      onCertificateChange();
    } catch (error: any) {
      console.error("Certificate upload error:", error);
      setParseError(error.message);
      toast.error(error.message || "Erro ao processar certificado");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveCertificate = async () => {
    if (!certificateData?.certificate_file_url) return;

    try {
      // Remove file from storage
      await supabase.storage
        .from('certificates')
        .remove([certificateData.certificate_file_url]);

      // Clear certificate data in database (including encrypted password)
      const { error } = await supabase
        .from('company_settings')
        .update({
          certificate_file_url: null,
          certificate_subject: null,
          certificate_issuer: null,
          certificate_valid_from: null,
          certificate_valid_to: null,
          certificate_serial_number: null,
          certificate_uploaded_at: null,
          certificate_password_encrypted: null,
        })
        .eq('user_id', userId);

      if (error) throw error;

      toast.success("Certificado removido");
      onCertificateChange();
    } catch (error) {
      toast.error("Erro ao remover certificado");
    }
  };

  const getExpirationStatus = () => {
    if (!certificateData?.certificate_valid_to) return null;
    
    const validTo = new Date(certificateData.certificate_valid_to);
    const daysUntilExpiry = differenceInDays(validTo, new Date());
    
    if (isPast(validTo)) {
      return { status: 'expired', text: 'Expirado', color: 'text-red-600' };
    }
    if (daysUntilExpiry <= 30) {
      return { status: 'warning', text: `Expira em ${daysUntilExpiry} dias`, color: 'text-yellow-600' };
    }
    return { status: 'valid', text: 'Válido', color: 'text-green-600' };
  };

  const expirationStatus = getExpirationStatus();

  return (
    <Card className="mt-6 bg-gray-100 shadow-md border-0">
      <CardHeader>
        <CardTitle className="text-gray-600 text-base flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Certificado Digital A1
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasCertificate ? (
          // Certificate installed view
          <div className="space-y-4">
            <div className={`p-4 rounded-lg border ${
              expirationStatus?.status === 'expired' 
                ? 'bg-red-50 border-red-200' 
                : expirationStatus?.status === 'warning'
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-green-50 border-green-200'
            }`}>
              <div className="flex items-center gap-2 mb-3">
                {expirationStatus?.status === 'expired' ? (
                  <ShieldAlert className="w-5 h-5 text-red-600" />
                ) : expirationStatus?.status === 'warning' ? (
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                ) : (
                  <ShieldCheck className="w-5 h-5 text-green-600" />
                )}
                <span className={`font-medium ${expirationStatus?.color}`}>
                  {expirationStatus?.status === 'expired' ? 'Certificado Expirado' : 'Certificado Instalado'}
                </span>
              </div>
              
              <div className="grid gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Titular:</span>{' '}
                  <span className="text-gray-700 font-medium">{certificateData.certificate_subject}</span>
                </div>
                <div>
                  <span className="text-gray-500">Emissor:</span>{' '}
                  <span className="text-gray-700">{certificateData.certificate_issuer}</span>
                </div>
                <div>
                  <span className="text-gray-500">Válido de:</span>{' '}
                  <span className="text-gray-700">
                    {certificateData.certificate_valid_from && 
                      format(new Date(certificateData.certificate_valid_from), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Válido até:</span>{' '}
                  <span className={`font-medium ${expirationStatus?.color}`}>
                    {certificateData.certificate_valid_to && 
                      format(new Date(certificateData.certificate_valid_to), "dd/MM/yyyy", { locale: ptBR })}
                    {expirationStatus && ` (${expirationStatus.text})`}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Número de série:</span>{' '}
                  <span className="text-gray-700 font-mono text-xs">{certificateData.certificate_serial_number}</span>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 gap-2"
              onClick={handleRemoveCertificate}
            >
              <Trash2 className="w-4 h-4" />
              Remover Certificado
            </Button>
          </div>
        ) : (
          // Upload form view
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-gray-300 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">
                {selectedFile ? selectedFile.name : 'Arraste seu arquivo .pfx ou clique para upload'}
              </p>
              <p className="text-xs text-gray-400 mt-1">Arquivos aceitos: .pfx, .p12</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pfx,.p12"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {selectedFile && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="cert-password">Senha do Certificado</Label>
                  <div className="relative">
                    <Input
                      id="cert-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Digite a senha do certificado"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {parseError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                    {parseError}
                  </div>
                )}

                <Button
                  className="w-full bg-[#273d60] hover:bg-[#273d60]/90 gap-2"
                  onClick={handleParseAndUpload}
                  disabled={isUploading || !password}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Instalar Certificado
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
