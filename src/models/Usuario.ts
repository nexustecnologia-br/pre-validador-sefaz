import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ValidationAttempt } from './ValidationAttempt';

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  senha!: string; // hashed password (bcrypt)

  @Column({ type: 'varchar', length: 255 })
  nome!: string;

  @Column({ type: 'varchar', length: 14, nullable: true })
  cpf!: string;

  @Column({ type: 'boolean', default: true })
  ativo!: boolean;

  @Column({ type: 'varchar', length: 20, default: 'usuario' })
  role!: 'admin' | 'empresa' | 'usuario';

  @CreateDateColumn({ type: 'timestamp' })
  criadoEm!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  atualizadoEm!: Date;

  @OneToMany(() => ValidationAttempt, (validation) => validation.usuario)
  validacoes?: ValidationAttempt[];
}
