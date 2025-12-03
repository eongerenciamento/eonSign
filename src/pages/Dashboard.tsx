import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { DocumentsTable, Document } from "@/components/documents/DocumentsTable";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBryStatusSync } from "@/hooks/useBryStatusSync";

const Dashboard = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [pendingByOwner, setPendingByOwner] = useState(0);
  const [pendingByExternal, setPendingByExternal] = useState(0);

  const currentDate = new Date();
  const weekDay = currentDate.toLocaleDateString('pt-BR', {
    weekday: 'long'
  });
  const date = currentDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  const subtitle = `${weekDay.charAt(0).toUpperCase() + weekDay.slice(1)}, ${date}`;

  const loadDocuments = useCallback(async () => {
    const {
      data: userData
    } = await supabase.auth.getUser();
    if (!userData.user) return;

    // Load recent documents with envelope info
    const {
      data: docsData,
      error: docsError
    } = await supabase.from("documents").select("*, envelopes(title)").eq("user_id", userData.user.id).order("created_at", {
      ascending: false
    });
    if (docsError) {
      console.error("Error loading documents:", docsError);
      return;
    }

    // Group documents by envelope_id
    const envelopeGroups = new Map<string, typeof docsData>();
    const standaloneDocuments: typeof docsData = [];

    (docsData || []).forEach(doc => {
      if (doc.envelope_id) {
        const existing = envelopeGroups.get(doc.envelope_id) || [];
        existing.push(doc);
        envelopeGroups.set(doc.envelope_id, existing);
      } else {
        standaloneDocuments.push(doc);
      }
    });

    // Convert to display format - envelopes show as single item
    const displayItems: any[] = [];

    // Add envelope groups (use first doc as representative)
    envelopeGroups.forEach((docs, envelopeId) => {
      const firstDoc = docs[0];
      const envelopeTitle = (firstDoc as any).envelopes?.title || firstDoc.name;
      displayItems.push({
        ...firstDoc,
        name: envelopeTitle,
        isEnvelope: true,
        documentCount: docs.length,
        envelopeDocuments: docs,
      });
    });

    // Add standalone documents
    standaloneDocuments.forEach(doc => {
      displayItems.push({
        ...doc,
        isEnvelope: false,
        documentCount: 1,
      });
    });

    // Sort by created_at and take first 5
    displayItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const recentItems = displayItems.slice(0, 5);

    // Load signers for each item
    const documentsWithSigners = await Promise.all(recentItems.map(async item => {
      // For envelopes, use the first document's signers (they share signers)
      const docIdForSigners = item.id;
      const {
        data: signersData
      } = await supabase.from("document_signers").select("*").eq("document_id", docIdForSigners).order("is_company_signer", {
        ascending: false
      });
      const signerNames = (signersData || []).map(s => s.name);
      const signerEmails = (signersData || []).map(s => s.email);
      const signerStatuses = (signersData || []).map(s => s.status as "pending" | "signed" | "rejected");
      return {
        id: item.id,
        name: item.name,
        createdAt: new Date(item.created_at).toLocaleDateString('pt-BR'),
        status: item.status as "pending" | "signed" | "expired" | "in_progress",
        signers: item.signers,
        signedBy: item.signed_by,
        folderId: item.folder_id,
        signerStatuses,
        signerNames,
        signerEmails,
        bryEnvelopeUuid: item.bry_envelope_uuid,
        isEnvelope: item.isEnvelope,
        documentCount: item.documentCount,
        envelopeId: item.envelope_id,
      };
    }));
    setDocuments(documentsWithSigners);

    // Calculate pending counts (count envelopes as 1)
    const pendingOwner = documentsWithSigners.filter(doc => doc.signerStatuses && doc.signerStatuses[0] === "pending").length;
    const pendingExt = documentsWithSigners.filter(doc => doc.signerStatuses && doc.signerStatuses.slice(1).some(status => status === "pending")).length;
    setPendingByOwner(pendingOwner);
    setPendingByExternal(pendingExt);
  }, []);

  // Automatic BRy status sync
  useBryStatusSync(documents, {
    onStatusChange: loadDocuments,
    pollingInterval: 30000,
  });

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  return <Layout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold text-gray-600">Dashboard</h1>
            <p className="text-xs text-gray-500 mt-1">
              {subtitle}
            </p>
          </div>
          <Button onClick={() => navigate("/novo-documento")} className="bg-gradient-to-r from-[#273d60] to-[#001f3f] text-white hover:from-[#2d4670] hover:to-[#002855] shadow-lg rounded-full w-12 h-12 p-0 md:w-auto md:h-auto md:rounded-md md:px-4 md:py-2">
            <Upload className="w-5 h-5 md:mr-2" />
            <span className="hidden md:inline">Documento</span>
          </Button>
        </div>

        {/* Pending Documents Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-gradient-to-r from-[#273d60] to-[#001f3f] border-none cursor-pointer hover:opacity-90 transition-opacity rounded-lg" onClick={() => navigate("/documentos?tab=pending-internal")}>
            <CardHeader className="pb-2 px-6 border-[#273d60] bg-[#273d60] rounded-md">
              <CardTitle className="text-white text-base">
                Pendentes
              </CardTitle>
              <p className="text-gray-200 text-xs">Sua Assinatura</p>
            </CardHeader>
            <CardContent className="px-6 pb-6 bg-[#273d60] rounded-md">
              <p className="text-3xl font-bold text-white">{pendingByOwner}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-[#273d60] to-[#001f3f] border-none cursor-pointer hover:opacity-90 transition-opacity rounded-lg" onClick={() => navigate("/documentos?tab=pending-external")}>
            <CardHeader className="pb-2 px-6 bg-[#273d60] rounded-md">
              <CardTitle className="text-white text-base">
                Pendentes
              </CardTitle>
              <p className="text-gray-200 text-xs">Signatários Externos</p>
            </CardHeader>
            <CardContent className="px-6 pb-6 bg-[#273d60] rounded-md">
              <p className="text-3xl font-bold text-white">{pendingByExternal}</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Documents */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm text-gray-600">
              Documentos Recentes
            </h2>
          </div>
          <DocumentsTable documents={documents} showFolderActions={false} />
        </div>
      </div>
    </Layout>;
};
export default Dashboard;