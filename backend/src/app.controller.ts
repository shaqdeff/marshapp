import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('test-db')
  async testDb() {
    try {
      // Test raw query to see what database we're connected to
      const dbInfo = await this.userRepository.query(`
        SELECT current_database() as database, 
               current_schema() as schema,
               current_user as user
      `);

      // Try to list tables using pg_tables (different approach)
      const tables = await this.userRepository.query(`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
      `);

      // Try direct SELECT from users table
      let userCount = 'error';
      try {
        const countResult = await this.userRepository.query(
          `SELECT COUNT(*) as count FROM users`,
        );
        userCount = countResult[0].count;
      } catch (e) {
        userCount = e.message;
      }

      return {
        success: true,
        connection: dbInfo[0],
        tables: tables.map((t) => t.tablename),
        userCount,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
