import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Shield,
  FileText,
  Users,
  Calendar,
  Download,
  Copy,
  Share2,
  FileDown,
  Timer,
} from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import logoEon from "@/assets/logo-eon-white.png";
import { jsPDF } from "jspdf";

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

interface TimestampInfo {
  applied: boolean;
  profile: string;
  authority: string;
  standard: string;
  legalBasis: string;
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
    hasTimestamp: boolean;
    timestampInfo: TimestampInfo | null;
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
        const { data: result, error: fetchError } = await supabase.functions.invoke("get-document-validation", {
          body: { documentId },
        });

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

  const handleDownloadCertificate = () => {
    if (!data) return;

    const { document, organization, signers } = data;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let yPos = 20;

    // Header background
    doc.setFillColor(39, 61, 96);
    doc.rect(0, 0, pageWidth, 45, "F");

    // Header text
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("CERTIFICADO DE VALIDAÇÃO", pageWidth / 2, 20, { align: "center" });

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("eonSign", pageWidth / 2, 30, { align: "center" });

    doc.setFontSize(10);
    doc.text(`Emitido por: ${organization.name}`, pageWidth / 2, 38, { align: "center" });

    yPos = 55;

    // Status section
    doc.setTextColor(0, 0, 0);
    const statusColor = data.valid ? [34, 197, 94] : [234, 179, 8];
    doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.roundedRect(margin, yPos, pageWidth - margin * 2, 25, 3, 3, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(data.valid ? "✓ DOCUMENTO VÁLIDO" : "⏳ DOCUMENTO PENDENTE", pageWidth / 2, yPos + 10, {
      align: "center",
    });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const statusText = data.valid
      ? "Este documento foi assinado por todos os signatários e possui validade jurídica."
      : `Aguardando ${document.totalSigners - document.signedCount} assinatura(s).`;
    doc.text(statusText, pageWidth / 2, yPos + 18, { align: "center" });

    yPos += 35;

    // Document Info Section
    doc.setTextColor(39, 61, 96);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("INFORMAÇÕES DO DOCUMENTO", margin, yPos);

    yPos += 8;
    doc.setDrawColor(39, 61, 96);
    doc.line(margin, yPos, pageWidth - margin, yPos);

    yPos += 10;
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    const docInfo = [
      ["Nome do Documento:", document.name],
      ["Tipo de Assinatura:", getSignatureModeLabel(document.signatureMode)],
      ["Data de Criação:", formatDate(document.createdAt)],
      ["Data de Conclusão:", document.completedAt ? formatDate(document.completedAt) : "Pendente"],
      ["ID do Documento:", document.id],
    ];

    // Signers Section
    doc.setTextColor(39, 61, 96);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`SIGNATÁRIOS (${document.signedCount}/${document.totalSigners})`, margin, yPos);

    yPos += 8;
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;

    signers.forEach((signer, index) => {
      // Check if we need a new page
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      // Signer box
      const boxHeight = signer.status === "signed" ? 35 : 15;
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(margin, yPos - 5, pageWidth - margin * 2, boxHeight, 2, 2, "F");

      // Signer status indicator
      if (signer.status === "signed") {
        doc.setFillColor(34, 197, 94);
      } else {
        doc.setFillColor(156, 163, 175);
      }
      doc.circle(margin + 5, yPos + 3, 3, "F");

      // Signer name and status
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(signer.name, margin + 12, yPos + 5);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const statusLabel = signer.status === "signed" ? "Assinado" : "Pendente";
      doc.setTextColor(
        signer.status === "signed" ? 34 : 156,
        signer.status === "signed" ? 197 : 163,
        signer.status === "signed" ? 94 : 175,
      );
      doc.text(`[${statusLabel}]`, margin + 12 + doc.getTextWidth(signer.name) + 3, yPos + 5);

      if (signer.status === "signed") {
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(9);

        let infoY = yPos + 12;

        if (signer.signed_at) {
          doc.text(`Data: ${formatDate(signer.signed_at)}`, margin + 12, infoY);
          infoY += 6;
        }

        const location = [signer.signature_city, signer.signature_state].filter(Boolean).join(", ");
        if (location) {
          doc.text(
            `Local: ${location}${signer.signature_country ? ` - ${signer.signature_country}` : ""}`,
            margin + 12,
            infoY,
          );
          infoY += 6;
        }

        if (signer.cpf) {
          doc.text(`CPF: ${signer.cpf}`, margin + 12, infoY);
          infoY += 6;
        }

        if (signer.signature_ip) {
          doc.text(`IP: ${signer.signature_ip}`, margin + 12, infoY);
        }
      }

      yPos += boxHeight + 5;
    });

    // Footer
    yPos = Math.max(yPos + 10, 260);
    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);

    yPos += 8;
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(
      "Este documento possui validade jurídica conforme Lei n. 14.063/2020 e MP 2.200-2/2001",
      pageWidth / 2,
      yPos,
      { align: "center" },
    );
    doc.text(`Verificado pelo sistema Eon Sign em ${formatDate(new Date().toISOString())}`, pageWidth / 2, yPos + 5, {
      align: "center",
    });
    doc.text(`URL de Validação: ${window.location.href}`, pageWidth / 2, yPos + 10, { align: "center" });

    // Save the PDF
    doc.save(`${document.name}_certificado_validacao.pdf`);
    toast.success("Certificado baixado com sucesso!");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" inline className="mx-auto mb-4" />
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
          <div className="flex items-center justify-center">
            <img src={logoEon} alt="Eon Sign" className="h-12" />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Validation Status Card */}
        <Card
          className={`mb-6 border-2 ${isValid ? "border-green-200 bg-green-50/50" : "border-yellow-200 bg-yellow-50/50"}`}
        >
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center ${isValid ? "bg-green-100" : "bg-yellow-100"}`}
              >
                {isValid ? (
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                ) : (
                  <Clock className="w-8 h-8 text-yellow-600" />
                )}
              </div>
              <div className="flex-1">
                <h1 className={`text-xl font-bold ${isValid ? "text-green-800" : "text-yellow-800"}`}>
                  {isValid ? "Documento Válido" : "Documento Pendente"}
                </h1>
                <p className={`text-[10px] ${isValid ? "text-green-700" : "text-yellow-700"}`}>
                  {isValid
                    ? "Este documento foi assinado por todos os signatarios e possui validade juridica"
                    : `Aguardando ${document.totalSigners - document.signedCount} assinatura(s) de ${document.totalSigners} signatario(s).`}
                </p>
                {isValid && (
                  <p className="text-[10px] text-green-700">Lei n. 14.063/2020 e MP 2.200-2/2001</p>
                )}
              </div>
            </div>

            {/* Download and Share Buttons */}
            {isValid && (
              <div className="mt-4 pt-4 border-t border-green-200 space-y-3">
                <div className="flex gap-2">
                  {document.downloadUrl && (
                    <Button
                      onClick={() => window.open(document.downloadUrl!, "_blank")}
                      className="flex-1 bg-white text-gray-600 hover:bg-gray-50 border-0 shadow-none text-sm"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Baixar Documento
                    </Button>
                  )}
                  <Button
                    className="flex-1 bg-white text-gray-600 hover:bg-gray-50 border-0 shadow-none text-sm"
                    onClick={handleDownloadCertificate}
                  >
                    <FileDown className="w-4 h-4 mr-2" />
                    Baixar Certificado
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-white text-gray-600 hover:bg-gray-50 border-0 shadow-none"
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      toast.success("Link copiado para a area de transferencia!");
                    }}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar Link
                  </Button>
                  <Button
                    className="flex-1 bg-white text-green-600 hover:bg-green-50 border-0 shadow-none"
                    onClick={() => {
                      const text = `Verifique o documento "${document.name}" assinado digitalmente: ${window.location.href}`;
                      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
                      window.open(whatsappUrl, "_blank");
                    }}
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    WhatsApp
                  </Button>
                </div>
              </div>
            )}
            {/* Download certificate button for pending documents */}
            {!isValid && (
              <div className="mt-4 pt-4 border-t border-yellow-200 flex gap-2">
                <Button
                  className="flex-1 bg-white text-gray-600 hover:bg-gray-50 border-0 shadow-none text-sm"
                  onClick={handleDownloadCertificate}
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  Baixar Certificado
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
                <p className="font-medium text-gray-900">
                  {document.completedAt ? formatDate(document.completedAt) : "Pendente"}
                </p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm text-gray-500">ID do Documento</p>
                <p className="font-mono text-sm text-gray-600 break-all">{document.id}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timestamp Info - only show when timestamp is applied */}
        {document.hasTimestamp && document.timestampInfo && (
          <Card className="mb-6 border-green-200 bg-green-50/30">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-primary">
                <Timer className="w-5 h-5" />
                <h3 className="font-semibold">Carimbo do Tempo</h3>
              </div>
            </CardHeader>
            <CardContent>
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="font-semibold text-green-700">Carimbo do Tempo Aplicado</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Perfil</p>
                    <p className="font-medium text-gray-900">{document.timestampInfo.profile}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Autoridade</p>
                    <p className="font-medium text-gray-900">{document.timestampInfo.authority}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Padrão</p>
                    <p className="font-medium text-gray-900">{document.timestampInfo.standard}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Base Legal</p>
                    <p className="font-medium text-gray-900">{document.timestampInfo.legalBasis}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
                            <div className="text-gray-600">
                              <span className="text-xs text-gray-400 break-all">
                                ID: {signer.signature_id}
                              </span>
                            </div>
                          )}

                          {signer.signature_ip && (
                            <div className="text-gray-600">
                              <span className="text-xs text-gray-400">
                                IP: {signer.signature_ip}
                              </span>
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
          <p>
            Verificado pelo sistema{" "}
            <a href="https://www.eonhub.com.br/sign" target="_blank" rel="noopener noreferrer" className="font-bold hover:underline">
              eonSign
            </a>{" "}
            em {formatDate(new Date().toISOString())}
          </p>
          <p className="mt-1">
            Powered by{" "}
            <a href="https://www.eonhub.com.br" target="_blank" rel="noopener noreferrer" className="font-bold hover:underline">
              eonhub
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ValidateDocument;
