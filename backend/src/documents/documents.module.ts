import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsModule } from '../accounts/accounts.module';
import { PatientsModule } from '../patients/patients.module';
import { TimelineModule } from '../timeline/timeline.module';
import { StorageModule } from '../storage/storage.module';
import { DocumentsController } from './controllers/documents.controller';
import { MyDocumentsController } from './controllers/my-documents.controller';
import { PatientDocumentsController } from './controllers/patient-documents.controller';
import { DocumentEntity } from './entities/document.entity';
import { DocumentsRepository } from './repositories/documents.repository';
import { DocumentAccessService } from './services/document-access.service';
import { DocumentTimelineService } from './services/document-timeline.service';
import { DocumentUploadService } from './services/document-upload.service';
import { DocumentsService } from './services/documents.service';

/**
 * Documentos do paciente: URL de envio (RFDOC001), confirmação (RFDOC002),
 * consulta e URL de leitura (RFDOC003) e consulta do paciente (RFDOC007).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentEntity]),
    AccountsModule,
    PatientsModule,
    StorageModule,
    TimelineModule,
  ],
  controllers: [
    PatientDocumentsController,
    DocumentsController,
    MyDocumentsController,
  ],
  providers: [
    DocumentAccessService,
    DocumentUploadService,
    DocumentsRepository,
    DocumentsService,
    DocumentTimelineService,
  ],
  exports: [DocumentAccessService, DocumentTimelineService],
})
export class DocumentsModule {}
