declare module 'cytoscape-navigator' {
  import cytoscape from 'cytoscape';
  const register: (cy: typeof cytoscape) => void;
  export default register;
}
