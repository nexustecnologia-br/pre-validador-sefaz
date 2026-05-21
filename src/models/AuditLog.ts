import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('audit_logs')
@Index(['empresaId', 'criadoEm'])
@Index(['usuarioId', 'criadoEm'])
@Index(['acao'])
@Index(['entidade'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  usuarioId?: string;

  @Column({ type: 'uuid', nullable: true })
  empresaId?: string;

  @Column({ type: 'varchar', length: 50 })
  acao!: 'criar' | 'ler' | 'atualizar' | 'deletar' | 'validar' | 'enviar' | 'login' | 'logout';

  @Column({ type: 'varchar', length: 100 })
  entidade!: string; // e.g., 'ValidationAttempt', 'Usuario', 'Empresa'

  @Column({ type: 'uuid', nullable: true })
  entidadeId?: string;

  @Column({ type: 'text', nullable: true })
  descricao?: string;

  @Column({ type: 'jsonb', nullable: true })
  dadosAntigos?: any; // Previous state before update

  @Column({ type: 'jsonb', nullable: true })
  dadosNovos?: any; // New state after update

  @Column({ type: 'varchar', length: 50, nullable: true })
  statusSolicitacao?: 'sucesso' | 'erro' | 'pendente';

  @Column({ type: 'text', nullable: true })
  mensagemErro?: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipOrigem?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent?: string;

  @CreateDateColumn({ type: 'timestamp' })
  criadoEm!: Date;
}
