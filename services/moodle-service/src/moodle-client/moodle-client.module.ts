import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MoodleClientService } from './moodle-client.service';

@Module({
  imports: [HttpModule],
  providers: [MoodleClientService],
  exports: [MoodleClientService],
})
export class MoodleClientModule {}
