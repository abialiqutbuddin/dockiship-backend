import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendMail(to: string, subject: string, html: string) {
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM,
        to,
        subject,
        html,
      });
    } catch (err) {
      console.error('Error sending email', err);
      throw new InternalServerErrorException('Failed to send email');
    }
  }
}