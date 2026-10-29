export interface FileCitation {
  readonly path:string;
  readonly startLine:number;
  readonly endLine:number;
  readonly quote?:string;
  readonly draft?:boolean;
}
export interface ResolvedCitation {
  readonly start:number;
  readonly end:number;
  readonly startLine:number;
  readonly endLine:number;
  readonly status:'exact'|'relocated'|'line-only';
}
export interface CitationState {readonly ranges:readonly FileCitation[];readonly revision:number;}
export interface CitationAction {readonly action:'insert'|'queue'|'copy';readonly citation:FileCitation;}
