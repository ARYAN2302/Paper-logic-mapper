declare module 'cytoscape-dagre' {
  import cytoscape from 'cytoscape';
  export default function register(cy: typeof cytoscape): void;
}
