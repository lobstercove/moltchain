// src/types/tradingview.d.ts
declare namespace TradingView {
	interface ChartingLibraryWidgetOptions {
	  symbol: string;
	  container: HTMLElement;
	  fullscreen?: boolean;
	  theme?: 'Light' | 'Dark';
	  width?: string | number; // Allow string for percentages like '100%'
	  height?: string | number; // Allow string for percentages like '100%'
	  library_path?: string;
	  interval?: ResolutionString; // Use ResolutionString
	  locale?: string;
	  datafeed: IBasicDataFeed;
	}
  
	// Match your SUPPORTED_RESOLUTIONS exactly
	type ResolutionString = '1' | '5' | '15' | '30' | '1H' | '4H' | '1D' | '1W' | '1M';
  
	interface DatafeedConfiguration {
	  supported_resolutions?: ResolutionString[];
	}
  
	type OnReadyCallback = (configuration: DatafeedConfiguration) => void;
	type SearchSymbolsCallback = (symbols: SymbolSearchResult[]) => void;
	type ResolveSymbolCallback = (symbolInfo: SymbolInfo) => void;
	type HistoryCallback = (bars: Bar[], meta: { noData: boolean }) => void;
	type RealtimeCallback = (bar: Bar) => void;
  
	interface SymbolSearchResult {
	  symbol: string;
	  full_name: string;
	  description: string;
	  exchange: string;
	  type: string;
	}
  
	interface SymbolInfo {
	  name: string;
	  ticker: string;
	  exchange: string;
	  type: string;
	  session: string;
	  timezone: string;
	  minmov: number;
	  pricescale: number;
	  has_intraday: boolean;
	  supported_resolutions?: ResolutionString[];
	}
  
	interface Bar {
	  time: number;
	  open: number;
	  high: number;
	  low: number;
	  close: number;
	  volume?: number;
	}
  
	interface PeriodParams {
	  from: number;
	  to: number;
	}
  
	interface IBasicDataFeed {
	  onReady: (callback: OnReadyCallback) => void;
	  searchSymbols: (
		userInput: string,
		exchange: string,
		symbolType: string,
		onResultReadyCallback: SearchSymbolsCallback
	  ) => void;
	  resolveSymbol: (
		symbolName: string,
		onSymbolResolvedCallback: ResolveSymbolCallback
	  ) => void;
	  getBars: (
		symbolInfo: any,
		resolution: string,
		periodParams: PeriodParams,
		onHistoryCallback: HistoryCallback
	  ) => void;
	  subscribeBars: (
		symbolInfo: any,
		resolution: string,
		onRealtimeCallback: RealtimeCallback
	  ) => void;
	  unsubscribeBars: () => void;
	}
  }
  
  declare global {
	interface Window {
	  TradingView: {
		widget: new (options: TradingView.ChartingLibraryWidgetOptions) => any;
	  };
	}
  }