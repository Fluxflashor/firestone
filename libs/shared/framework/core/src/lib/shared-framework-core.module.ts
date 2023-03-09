import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { SharedFrameworkCommonModule } from '@firestone/shared/framework/common';
import { FsTranslateDirective } from './localization/fs-translate.directive';
import { FsTranslatePipe } from './localization/fs-translate.pipe';
import { CardsFacadeService } from './services/cards-facade.service';
import { DiskCacheService } from './services/disk-cache.service';
import { LocalStorageService } from './services/local-storage';
import { OverwolfService } from './services/overwolf.service';

const components = [FsTranslateDirective, FsTranslatePipe];

@NgModule({
	imports: [CommonModule, SharedFrameworkCommonModule],
	providers: [OverwolfService, CardsFacadeService, DiskCacheService, LocalStorageService],
	declarations: components,
	exports: components,
})
export class SharedFrameworkCoreModule {}
