import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Usuario } from './Usuario';
import { Empresa } from './Empresa';

@Entity('validation_attempts')
@Index(['empresa', 'criadoEm'])
@Index(['usuario', 'criadoEm'])
@Index(['status'])
export class ValidationAttempt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  empresaId!: string;

  @Column({ type: 'uuid' })
  usuarioId!: string;

  @Column({ type: 'text' })
  xmlContent!: string;

  @Column({ type: 'varchar', length: 20, default: 'pendente' })
  status!: 'pendente' | 'processando' | 'aprovado' | 'rejeitado';

  @Column({ type: 'varchar', length: 20, nullable: true })
  nfe?: string; // NF number (e.g., "123456/001")

  @Column({ type: 'date', nullable: true })
  dataEmissao?: Date;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  valor!: number;

  @Column({ type: 'varchar', length: 14, nullable: true })
  cnpjFornecedor?: string;

  @Column({ type: 'varchar', length: 14, nullable: true })
  cnpjComprador?: string;

  @Column({ type: 'integer', default: 0 })
  cfop?: number;

  @Column({ type: 'varchar', length: 2, nullable: true })
  cst?: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  icmsAliquota?: number;

  // Validation results
  @Column({ type: 'boolean', default: false })
  validoXSD!: boolean;

  @Column({ type: 'boolean', default: false })
  validoRegras!: boolean;

  @Column({ type: 'integer', default: 0 })
  totalErros!: number;

  @Column({ type: 'integer', default: 0 })
  errosCriticos!: number;

  @Column({ type: 'integer', default: 0 })
  errosAvisos!: number;

  @Column({ type: 'jsonb', nullable: true })
  erros?: any; // Array of ValidationError objects

  @Column({ type: 'integer', default: 0 })
  tempoProcessamento!: number; // milliseconds

  @Column({ type: 'text', nullable: true })
  observacoes?: string;

  @Column({ type: 'boolean', default: false })
  enviado?: boolean; // Whether sent to SEFAZ

  @Column({ type: 'date', nullable: true })
  dataEnvio?: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  numeroProtocoloSEFAZ?: string;

  @CreateDateColumn({ type: 'timestamp' })
  criadoEm!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  atualizadoEm!: Date;

  // Relations
  @ManyToOne(() => Empresa, (empresa) => empresa.validacoes)
  @JoinColumn({ name: 'empresaId' })
  empresa?: Empresa;

  @ManyToOne(() => Usuario, (usuario) => usuario.validacoes)
  @JoinColumn({ name: 'usuarioId' })
  usuario?: Usuario;
}
