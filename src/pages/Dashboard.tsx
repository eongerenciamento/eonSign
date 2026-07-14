import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { DocumentsTable, Document } from "@/components/documents/DocumentsTable";
import { Plus, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBryStatusSync } from "@/hooks/useBryStatusSync";
const Dashboard = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [pendingByOwner, setPendingByOwner] = useState(0);
  const [pendingByExternal, setPendingByExternal] = useState(0);
  const [displayName, setDisplayName] = useState("");
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
  const rawFullDate = currentDate.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const dateLabel = rawFullDate.charAt(0).toUpperCase() + rawFullDate.slice(1);
  const firstName = displayName.trim().split(" ")[0] || "Usuário";
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
        envelopeDocuments: docs
      });
    });

    // Add standalone documents
    standaloneDocuments.forEach(doc => {
      displayItems.push({
        ...doc,
        isEnvelope: false,
        documentCount: 1
      });
    });

    // Sort by created_at and take first 5
    displayItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const recentItems = displayItems.slice(0, 5);

    // Load company settings for fallback
    const { data: companyData } = await supabase.from("company_settings").select("admin_name, admin_email, admin_phone").eq("user_id", userData.user.id).single();
    setDisplayName(companyData?.admin_name || userData.user.user_metadata?.name || "");

    // Load signers for each item
    const documentsWithSigners = await Promise.all(recentItems.map(async item => {
      // For envelopes, use the first document's signers (they share signers)
      const docIdForSigners = item.id;
      const {
        data: signersData
      } = await supabase.from("document_signers").select("*").eq("document_id", docIdForSigners).order("is_company_signer", {
        ascending: false
      });

      let finalSigners = signersData || [];

      // Fallback: if signers count in DB is less than document.signers, add internal signer from company_settings
      if (finalSigners.length < item.signers && companyData) {
        const hasInternal = finalSigners.some(s => s.is_company_signer);
        if (!hasInternal) {
          finalSigners = [
            { name: companyData.admin_name, email: companyData.admin_email, phone: companyData.admin_phone, status: 'signed', is_company_signer: true } as any,
            ...finalSigners
          ];
        }
      }

      const signerNames = finalSigners.map(s => s.name);
      const signerEmails = finalSigners.map(s => s.email);
      const signerPhones = finalSigners.map(s => s.phone);
      const signerStatuses = finalSigners.map(s => s.status as "pending" | "signed" | "rejected");

      // Format envelope documents for the dialog
      const envelopeDocuments = item.envelopeDocuments?.map((doc: any) => ({
        id: doc.id,
        name: doc.name,
        file_url: doc.file_url,
        status: doc.status,
        signed_by: doc.signed_by,
        signers: doc.signers,
        bry_signed_file_url: doc.bry_signed_file_url,
        bry_envelope_uuid: doc.bry_envelope_uuid
      }));
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
        signerPhones,
        bryEnvelopeUuid: item.bry_envelope_uuid,
        isEnvelope: item.isEnvelope,
        documentCount: item.documentCount,
        envelopeId: item.envelope_id,
        envelopeDocuments,
        signatureMode: item.signature_mode as "SIMPLE" | "ADVANCED" | "QUALIFIED" | "PRESCRIPTION" | null,
        patientName: item.patient_name,
        prescriptionDocType: item.prescription_doc_type,
      };
    }));
    setDocuments(documentsWithSigners);

    // Calculate pending counts (count envelopes as 1)
    const pendingOwner = documentsWithSigners.filter(doc => doc.signerStatuses && doc.signerStatuses[0] === "pending").length;
    const pendingExt = documentsWithSigners.filter(doc => doc.signerStatuses && doc.signerStatuses.slice(1).some(status => status === "pending")).length;
    setPendingByOwner(pendingOwner);
    setPendingByExternal(pendingExt);
  }, []);

  // Automatic BRy status sync (adaptive polling: 10s initial, 20s after)
  useBryStatusSync(documents, {
    onStatusChange: loadDocuments,
  });
  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);
  return <Layout>
      <div className="space-y-6">
        {/* Mobile header: gradient greeting + glass metric cards */}
        <div
          className="relative px-4 pb-8 text-white lg:hidden"
          style={{
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.5rem)",
            marginTop: "calc(env(safe-area-inset-top, 0px) * -1)",
            backgroundImage:
              "radial-gradient(120% 70% at 85% 110%, hsl(var(--background)) 0%, hsl(var(--background) / 0) 55%), linear-gradient(to bottom, hsl(218 55% 10%) 0%, hsl(217 50% 18%) 18%, hsl(216 45% 32%) 38%, hsl(214 38% 55%) 58%, hsl(210 30% 80%) 80%, hsl(var(--background)) 100%)",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-white">Bem-vindo, {firstName}</p>
              <p className="truncate text-xs font-light text-white/70">{dateLabel}</p>
            </div>
            <button
              type="button"
              aria-label="Notificações"
              className="relative shrink-0 bg-transparent p-0 text-white outline-none focus:outline-none focus-visible:outline-none hover:bg-transparent active:bg-transparent border-0"
            >
              <Bell className="h-5 w-5" strokeWidth={1.25} />
            </button>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div
              className="cursor-pointer rounded-xl border-0 bg-white/15 p-4 shadow-lg backdrop-blur-xl backdrop-saturate-150"
              onClick={() => navigate("/documentos?tab=pending-internal")}
            >
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-300" />
                <span className="text-[11px] font-light uppercase tracking-wide text-white/80">Pendentes</span>
              </div>
              <p className="mt-1 truncate text-[11px] font-light text-white/70">Sua Assinatura</p>
              <p className="mt-2 truncate text-lg font-semibold text-white tabular-nums">{pendingByOwner}</p>
            </div>

            <div
              className="cursor-pointer rounded-xl border-0 bg-white/15 p-4 shadow-lg backdrop-blur-xl backdrop-saturate-150"
              onClick={() => navigate("/documentos?tab=pending-external")}
            >
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-300" />
                <span className="text-[11px] font-light uppercase tracking-wide text-white/80">Pendentes</span>
              </div>
              <p className="mt-1 truncate text-[11px] font-light text-white/70">Signatários Externos</p>
              <p className="mt-2 truncate text-lg font-semibold text-white tabular-nums">{pendingByExternal}</p>
            </div>
          </div>
        </div>

        <div className="px-8 space-y-6 lg:pt-8">
          {/* Desktop header */}
          <div className="hidden items-center justify-between lg:flex">
            <div>
              <h1 className="text-sm font-bold text-muted-foreground">Dashboard</h1>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {subtitle}
              </p>
            </div>
            <Button onClick={() => navigate("/novo-documento")} className="bg-blue-600 hover:bg-blue-700 shadow-lg rounded-full px-4 py-2 font-normal">
              <Plus className="w-5 h-5 mr-2 text-white" />
              <span className="text-white">Documento</span>
            </Button>
          </div>

          {/* Desktop pending documents cards */}
          <div className="hidden grid-cols-2 gap-4 lg:grid">
            <div
              className="flex flex-col items-center justify-center text-center gap-1 py-6 cursor-pointer"
              onClick={() => navigate("/documentos?tab=pending-internal")}
            >
              <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">{pendingByOwner}</p>
              <p className="text-foreground text-base">Pendentes</p>
              <p className="text-muted-foreground text-xs">Sua Assinatura</p>
            </div>

            <div
              className="flex flex-col items-center justify-center text-center gap-1 py-6 cursor-pointer"
              onClick={() => navigate("/documentos?tab=pending-external")}
            >
              <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">{pendingByExternal}</p>
              <p className="text-foreground text-base">Pendentes</p>
              <p className="text-muted-foreground text-xs">Signatários Externos</p>
            </div>
          </div>

          {/* Mobile "novo documento" button, below the gradient header */}
          <Button onClick={() => navigate("/novo-documento")} className="w-full bg-blue-600 hover:bg-blue-700 shadow-lg rounded-full font-normal lg:hidden">
            <Plus className="w-5 h-5 mr-2 text-white" />
            <span className="text-white">Documento</span>
          </Button>

          {/* Recent Documents */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm text-foreground">
              Documentos Recentes
            </h2>
          </div>
          <DocumentsTable documents={documents} showFolderActions={false} onRefresh={loadDocuments} hideHeader compactActions />
        </div>
        </div>
      </div>
    </Layout>;
};
export default Dashboard;