import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Clock, MapPin, Shield, FileText, Users, Calendar, Building2, Loader2, Download } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import logoEon from "@/assets/logo-eon.png";

interface Signer {
  id: string;
  name: string;
  status: string;
  signed_at: string | null;
  signature_ip: string | null;
  signature_city: string | null;
  signature_state: string | null;
  signature_country: string | null;
  signature_id: string | null;
  cpf: string | null;
}

interface DocumentValidation {
  valid: boolean;
  document: {
    id: string;
    name: string;
    status: string;
    signatureMode: string;
    createdAt: string;
    completedAt: string | null;
    totalSigners: number;
    signedCount: number;
    downloadUrl: string | null;
  };
  organization: {
    name: string;
    logoUrl: string | null;
  };
  signers: Signer[];
}

const ValidateDocument = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DocumentValidation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchValidation = async () => {
      if (!documentId) {
        setError("ID do documento nao fornecido");
        setLoading(false);
        return;
      }

      try {
        const { data: result, error: fetchError } = await supabase.functions.invoke(
          "get-document-validation",
          { body: { documentId } }
        );

        if (fetchError) {
          throw fetchError;
        }

        if (result.error) {
          setError(result.error);
        } else {
          setData(result);
        }
      } catch (err: any) {
        console.error("Error fetching validation:", err);
        setError("Erro ao verificar documento");
      } finally {
        setLoading(false);
      }
    };

    fetchValidation();
  }, [documentId]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getSignatureModeLabel = (mode: string) => {
    switch (mode) {
      case "SIMPLE":
        return "Assinatura Simples";
      case "ADVANCED":
        return "Assinatura Avancada";
      case "QUALIFIED":
        return "Assinatura Qualificada";
      default:
        return "Assinatura Eletronica";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600">Verificando documento...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-10 h-10 text-red-600" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">Documento Nao Encontrado</h1>
              <p className="text-gray-600">{error || "O documento solicitado nao foi encontrado ou nao existe."}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { document, organization, signers } = data;
  const isValid = data.valid;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#273d60] to-[#001a4d] text-white">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {organization.logoUrl ? (
                <img 
                  src={organization.logoUrl} 
                  alt={organization.name} 
                  className="h-12 w-auto object-contain bg-white rounded-lg p-1"
                />
              ) : (
                <div className="h-12 w-12 bg-white/10 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6" />
                </div>
              )}
              <div>
                <p className="text-white/70 text-sm">Emitido por</p>
                <h2 className="font-semibold">{organization.name}</h2>
              </div>
            </div>
            <img src={logoEon} alt="Eon Sign" className="h-8 opacity-80" />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Validation Status Card */}
        <Card className={`mb-6 border-2 ${isValid ? "border-green-200 bg-green-50/50" : "border-yellow-200 bg-yellow-50/50"}`}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${isValid ? "bg-green-100" : "bg-yellow-100"}`}>
                {isValid ? (
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                ) : (
                  <Clock className="w-8 h-8 text-yellow-600" />
                )}
              </div>
              <div className="flex-1">
                <h1 className={`text-xl font-bold ${isValid ? "text-green-800" : "text-yellow-800"}`}>
                  {isValid ? "Documento Valido" : "Documento Pendente"}
                </h1>
                <p className={`${isValid ? "text-green-700" : "text-yellow-700"}`}>
                  {isValid 
                    ? "Este documento foi assinado por todos os signatarios e possui validade juridica."
                    : `Aguardando ${document.totalSigners - document.signedCount} assinatura(s) de ${document.totalSigners} signatario(s).`
                  }
                </p>
              </div>
              <Badge variant={isValid ? "default" : "secondary"} className={isValid ? "bg-green-600" : "bg-yellow-600"}>
                <Shield className="w-3 h-3 mr-1" />
                {isValid ? "Verificado" : "Pendente"}
              </Badge>
            </div>
            
            {/* Download Button */}
            {isValid && document.downloadUrl && (
              <div className="mt-4 pt-4 border-t border-green-200">
                <Button
                  onClick={() => window.open(document.downloadUrl!, '_blank')}
                  className="w-full bg-gradient-to-r from-[#273d60] to-[#001a4d] hover:opacity-90"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Baixar Documento Assinado
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Document Info */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-primary">
              <FileText className="w-5 h-5" />
              <h3 className="font-semibold">Informacoes do Documento</h3>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Nome do Documento</p>
                <p className="font-medium text-gray-900">{document.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Tipo de Assinatura</p>
                <p className="font-medium text-gray-900">{getSignatureModeLabel(document.signatureMode)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Data de Criacao</p>
                <p className="font-medium text-gray-900">{formatDate(document.createdAt)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Data de Conclusao</p>
                <p className="font-medium text-gray-900">{document.completedAt ? formatDate(document.completedAt) : "Pendente"}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm text-gray-500">ID do Documento</p>
                <p className="font-mono text-sm text-gray-600 break-all">{document.id}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Signers */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary">
                <Users className="w-5 h-5" />
                <h3 className="font-semibold">Signatarios</h3>
              </div>
              <Badge variant="outline">
                {document.signedCount}/{document.totalSigners} assinados
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {signers.map((signer, index) => (
                <div key={signer.id}>
                  {index > 0 && <Separator className="my-4" />}
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                      signer.status === "signed" ? "bg-green-500" : "bg-gray-400"
                    }`}>
                      {signer.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900">{signer.name}</h4>
                        {signer.status === "signed" ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Assinado
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                            <Clock className="w-3 h-3 mr-1" />
                            Pendente
                          </Badge>
                        )}
                      </div>
                      
                      {signer.status === "signed" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-sm">
                          <div className="flex items-center gap-2 text-gray-600">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span>{formatDate(signer.signed_at)}</span>
                          </div>
                          
                          {(signer.signature_city || signer.signature_state) && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <MapPin className="w-4 h-4 text-gray-400" />
                              <span>
                                {[signer.signature_city, signer.signature_state].filter(Boolean).join(", ")}
                                {signer.signature_country && ` - ${signer.signature_country}`}
                              </span>
                            </div>
                          )}
                          
                          {signer.cpf && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <Shield className="w-4 h-4 text-gray-400" />
                              <span>CPF: {signer.cpf}</span>
                            </div>
                          )}
                          
                          {signer.signature_id && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <span className="text-xs text-gray-400">ID: {signer.signature_id.substring(0, 18)}...</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Este documento possui validade juridica conforme Lei n. 14.063/2020 e MP 2.200-2/2001</p>
          <p className="mt-1">Verificado pelo sistema Eon Sign em {formatDate(new Date().toISOString())}</p>
        </div>
      </div>
    </div>
  );
};

export default ValidateDocument;
