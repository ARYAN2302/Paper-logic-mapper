declare module 'react-cytoscapejs' {
  import React from 'react';
  import cytoscape from 'cytoscape';

  interface CytoscapeComponentProps {
    elements: cytoscape.ElementDefinition[];
    layout?: cytoscape.LayoutOptions;
    style?: cytoscape.Stylesheet[];
    [key: string]: any;
  }

  const CytoscapeComponent: React.ComponentType<CytoscapeComponentProps>;
  export default CytoscapeComponent;
}
