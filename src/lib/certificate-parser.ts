import forge from 'node-forge';

export interface CertificateMetadata {
  subject: string;
  issuer: string;
  validFrom: Date;
  validTo: Date;
  serialNumber: string;
}

export async function parsePfxCertificate(file: File, password: string): Promise<CertificateMetadata> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer;
        const bytes = new Uint8Array(arrayBuffer);
        let binaryString = '';
        for (let i = 0; i < bytes.length; i++) {
          binaryString += String.fromCharCode(bytes[i]);
        }
        
        const p12Asn1 = forge.asn1.fromDer(binaryString);
        const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
        
        const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
        const certBag = certBags[forge.pki.oids.certBag];
        
        if (!certBag || certBag.length === 0) {
          reject(new Error('Certificado não encontrado no arquivo'));
          return;
        }

        const cert = certBag[0].cert;
        if (!cert) {
          reject(new Error('Certificado inválido'));
          return;
        }
        
        const subjectCN = cert.subject.getField('CN');
        const issuerCN = cert.issuer.getField('CN');
        
        resolve({
          subject: subjectCN ? String(subjectCN.value) : 'N/A',
          issuer: issuerCN ? String(issuerCN.value) : 'N/A',
          validFrom: cert.validity.notBefore,
          validTo: cert.validity.notAfter,
          serialNumber: cert.serialNumber,
        });
      } catch (error: any) {
        if (error.message?.includes('Invalid password') || 
            error.message?.includes('PKCS#12 MAC') ||
            error.message?.includes('Invalid PKCS#12')) {
          reject(new Error('Senha incorreta para o certificado'));
        } else {
          reject(new Error('Erro ao processar o certificado: ' + error.message));
        }
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Erro ao ler o arquivo'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}
