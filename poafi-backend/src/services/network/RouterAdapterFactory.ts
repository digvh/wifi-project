import {
  IRouterAdapter,
  RouterVendor,
  RouterConnectionConfig,
} from './types';
import { MikroTikAdapter } from './adapters/MikroTikAdapter';
import { TPLinkOmadaAdapter } from './adapters/TPLinkOmadaAdapter';
import { RuijieAdapter } from './adapters/RuijieAdapter';
import { CudyAdapter } from './adapters/CudyAdapter';
import { ComfastAdapter } from './adapters/ComfastAdapter';
import { WavlinkAdapter } from './adapters/WavlinkAdapter';

export class RouterAdapterFactory {
  static getAdapter(vendor: string | RouterVendor, config: RouterConnectionConfig): IRouterAdapter {
    const normalizedVendor = (vendor || 'MIKROTIK').toUpperCase() as RouterVendor;

    switch (normalizedVendor) {
      case 'MIKROTIK':
        return new MikroTikAdapter(config);

      case 'TPLINK_OMADA':
        return new TPLinkOmadaAdapter(config);

      case 'RUIJIE':
        return new RuijieAdapter(config);

      case 'CUDY':
        return new CudyAdapter(config);

      case 'COMFAST':
        return new ComfastAdapter(config);

      case 'WAVLINK':
        return new WavlinkAdapter(config);

      default:
        throw new Error(`Unsupported router vendor: ${vendor}. Supported brands are: MIKROTIK, TPLINK_OMADA, RUIJIE, CUDY, COMFAST, WAVLINK`);
    }
  }
}

