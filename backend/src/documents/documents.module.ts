import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { PatientsModule } from '../patients/patients.module';
import { StorageModule } from '../storage/storage.module';
import { PatientDocumentsController } from './controllers/patient-documents.controller';
import { DocumentAccessService } from './services/document-access.service';
import { DocumentUploadService } from './services/document-upload.service';

/** Documentos do paciente: por enquanto, a URL de envio (RFDOC001). */
@Module({
  imports: [AccountsModule, PatientsModule, StorageModule],
  controllers: [PatientDocumentsController],
  providers: [DocumentAccessService, DocumentUploadService],
  exports: [DocumentAccessService],
})
export class DocumentsModule {}
