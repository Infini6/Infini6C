import { Module } from '@nestjs/common';
import { NavigationService } from './navigation.service.js';
import { NavigationController } from './navigation.controller.js';

@Module({
  controllers: [NavigationController],
  providers: [NavigationService],
  exports: [NavigationService],
})
export class NavigationModule {}
