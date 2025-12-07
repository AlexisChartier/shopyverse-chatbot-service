import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from "typeorm";

@Entity("chat_interactions")
export class ChatInteraction {
  @PrimaryGeneratedColumn("increment")
  id!: number;

  @Column()
  sessionId!: string;

  @Column()
  intent!: string;

  @Column("text")
  userMessage!: string;

  @Column("text")
  assistantAnswer!: string;

  @Column({ default: false })
  hasFallback!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}