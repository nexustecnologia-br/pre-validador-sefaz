import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ValidationAttempt } from './ValidationAttempt';

@Entity('empresas')
export class Empresa {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 14, unique: true })
  cnpj!: string;

  @Column({ type: 'varchar', length: 255 })
  razaoSocial!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nomeFantasia!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'lucro_real',
  })
  regime!: 'simples' | 'lucro_real' | 'lucro_presumido';

  @Column({ type: 'varchar', length: 255, nullable: true })
  endereco!: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  numero!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  complemento!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  bairro!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  cidade!: string;

  @Column({ type: 'varchar', length: 2, default: 'RS' })
  estado!: string;

  @Column({ type: 'varchar', length: 8, nullable: true })
  cep!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  telefone!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string;

  @Column({ type: 'boolean', default: true })
  ativo!: boolean;

  @Column({ type: 'integer', default: 0 })
  totalValidacoes!: number;

  @Column({ type: 'integer', default: 0 })
  validacoesAprovadas!: number;

  @Column({ type: 'integer', default: 0 })
  validacoesRejeitadas!: number;

  @CreateDateColumn({ type: 'timestamp' })
  criadoEm!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  atualizadoEm!: Date;

  @OneToMany(() => ValidationAttempt, (validation) => validation.empresa)
  validacoes?: ValidationAttempt[];
}
