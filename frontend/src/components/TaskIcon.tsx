const paths: Record<string, string> = {
  home: 'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
  child: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-2a8 8 0 0 1 16 0v2',
  add: 'M12 5v14M5 12h14',
  measure: 'M5 21V10h4v11M10 21V5h4v16M15 21V2h4v19',
  alert: 'M12 3 2 21h20L12 3ZM12 9v5M12 17v1',
  report: 'M14 2H5v20h14V7l-5-5ZM14 2v6h5M8 12h8M8 16h8',
  history: 'M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2',
  help: 'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 4M12 17v1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
}
export function TaskIcon({ name }: { name: string }) {
 return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] ?? paths.report}/></svg>
}
