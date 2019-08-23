import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { SharedModule } from './shared.module';

if (process.env.NODE_ENV === 'production') {
	enableProdMode();
}

platformBrowserDynamic().bootstrapModule(SharedModule);
