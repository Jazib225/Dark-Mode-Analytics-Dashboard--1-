/**
 * TradeFlow Implementation Summary
 * 
 * This file documents the implementation of the TradeFlow feature for Paragon.
 * TradeFlow is a drag-and-drop workflow builder for creating trading logic.
 * 
 * ========================================
 * IMPLEMENTATION CHECKLIST
 * ========================================
 * 
 * ✅ NAVIGATION & ROUTING
 * - Added "TradeFlow" link in header navigation between "Wallets" and "Portfolio"
 * - Route: /tradeflow (page-based navigation)
 * - Active/selected state styling consistent with other nav links
 * - Type updated: Page = "discover" | "markets" | "wallets" | "insiderlens" | "portfolio" | "tradeflow" | "search"
 * 
 * ✅ MAIN PAGE STRUCTURE (TradeFlow.tsx)
 * - Three-panel layout:
 *   • Left panel: NodeLibrary (draggable node types)
 *   • Center panel: WorkflowCanvas (workflow editor)
 *   • Right panel: NodeInspector (node property editor)
 * - Top toolbar with:
 *   • Title and description
 *   • Validate button - checks workflow validity
 *   • Save button - saves to localStorage
 *   • Export button - downloads workflow as JSON
 *   • Clear button - clears canvas with confirmation dialog
 * - Validation error display
 * - Status bar showing node/edge count and last save time
 * 
 * ✅ NODE LIBRARY (NodeLibrary.tsx)
 * - Four collapsible stage sections:
 *   1. Market Type
 *   2. Entry Conditions
 *   3. Exit Conditions
 *   4. Profit Taking
 * - Draggable node options per stage:
 *   • Market Type: [market]
 *   • Entry Conditions: [entry, and, or, add, subtract, multiply, divide]
 *   • Exit Conditions: [exit, and, or, add, subtract, multiply, divide]
 *   • Profit Taking: [profit]
 * - Node descriptions for user guidance
 * - Drag-and-drop data transfer setup
 * 
 * ✅ WORKFLOW CANVAS (WorkflowCanvas.tsx)
 * - Custom canvas-based rendering (no external library dependency)
 * - Features:
 *   • Grid background
 *   • Node positioning and dragging
 *   • Arrow-based edge rendering
 *   • Connection visualization (dotted line while connecting)
 *   • Click to select nodes
 *   • Right-click to create connections
 *   • Drag nodes from library to canvas
 *   • Delete nodes with Trash button
 *   • Node ports (input/output indicators)
 * - Help text when canvas is empty
 * - Z-ordering: canvas underneath, nodes on top
 * 
 * ✅ WORKFLOW NODES (WorkflowNode.tsx)
 * - Color-coded by category:
 *   • Market Type: blue (bg-blue-900/40)
 *   • Entry Conditions: green (bg-green-900/40)
 *   • Exit Conditions: orange (bg-orange-900/40)
 *   • Profit Taking: purple (bg-purple-900/40)
 *   • Logic/Math: gray (bg-gray-700/60, bg-yellow-900/40)
 * - Node display:
 *   • Label showing node type
 *   • Data summary (e.g., market type, field, value)
 *   • Input/output port circles
 *   • Delete button
 *   • Selected state with white ring
 *   • Hover effects
 * - Draggable and droppable
 * - Click to select
 * 
 * ✅ NODE INSPECTOR (NodeInspector.tsx)
 * - Right panel for editing selected node
 * - Dynamic form based on node type:
 *   
 *   Market Type Node:
 *   - Market Type selector (All, Sports, Politics, Crypto, Economics)
 *   - Search Keyword input
 *   - Min Liquidity ($) input
 *   - Min Volume ($) input
 *   
 *   Entry/Exit Condition Nodes:
 *   - Field selector (price, spread, liquidity, 24h volume, etc.)
 *   - Operator selector (>, <, >=, <=, ==, !=)
 *   - Value input
 *   - Trailing Stop toggle (exit only)
 *   
 *   Profit Taking Node:
 *   - Type selector (Percentage or Threshold)
 *   - Target Value input
 *   - Partial Profit selector (25%, 50%, 100%)
 *   
 *   Logic/Math Nodes:
 *   - Display-only descriptions
 * 
 * ✅ WORKFLOW VALIDATION (validators.ts)
 * - validateWorkflow(): Checks edge direction and stage order
 * - canConnect(): Validates if two nodes can be connected
 * - buildExpressionPreview(): Generates readable expression strings
 * - Stage order enforcement: market → entry → exit → profit
 * - Operator nodes (and/or/math) can connect within same stage
 * - Returns detailed ValidationError objects
 * 
 * ✅ STATE MANAGEMENT & STORAGE (storage.ts)
 * - createDefaultWorkflow(): Creates empty workflow schema
 * - saveWorkflow(): Persists to localStorage key "paragon_tradeflow_v1"
 * - loadWorkflow(): Retrieves saved workflow
 * - clearWorkflow(): Removes saved workflow
 * - addNodeToWorkflow(): Creates and adds new node
 * - updateNodeData(): Updates node properties
 * - moveNode(): Updates node position
 * - removeNode(): Removes node and related edges
 * - addEdge(): Creates connection between nodes
 * - removeEdge(): Removes connection
 * - selectNode(): Sets selected node
 * 
 * ✅ DATA TYPES (types.ts)
 * - NodeStage: "market" | "entry" | "exit" | "profit"
 * - NodeType: All 10 node types
 * - NodeData: Full node definition
 * - EdgeData: Connection definition
 * - WorkflowSchema: Complete workflow state
 * - ValidationError: Error reporting
 * - Specialized data interfaces for each node type
 * 
 * ========================================
 * STYLING CONSISTENCY
 * ========================================
 * 
 * - Color scheme matches Paragon dark theme (#0a0a0a, #1a1a1a, etc.)
 * - Uses Tailwind CSS classes consistent with app
 * - Border colors: gray-700, gray-800
 * - Text colors: gray-100, gray-300, gray-500
 * - Accent colors from category color-coding
 * - Spacing and padding consistent with app conventions
 * - Button styles match existing UI patterns
 * - Hover and active states properly styled
 * 
 * ========================================
 * KEY FEATURES IMPLEMENTED
 * ========================================
 * 
 * 1. Drag-and-Drop Node Creation
 *    - Drag from library to canvas
 *    - Automatic position assignment
 *    - Node initialization with default data
 * 
 * 2. Visual Connection Building
 *    - Right-click nodes to start connection
 *    - Dotted line preview while dragging
 *    - Arrow-based edge rendering
 *    - Smart connection validation
 * 
 * 3. Multi-Stage Workflow Validation
 *    - Enforces left-to-right flow
 *    - Prevents backward edges
 *    - Allows operator nodes within same stage
 *    - Validates on every change
 * 
 * 4. Node Editing
 *    - Click nodes to select
 *    - Inspector panel for property editing
 *    - Real-time data updates
 *    - Field-specific controls
 * 
 * 5. Canvas Management
 *    - Pan/move nodes
 *    - Grid background
 *    - Zoom via mouse wheel (canvas auto-resize)
 *    - Delete nodes and edges
 *    - Multi-select via Ctrl+Click (can enhance)
 * 
 * 6. Workflow Persistence
 *    - Auto-save to localStorage
 *    - Manual save button
 *    - JSON export for backup/sharing
 *    - Last save timestamp display
 * 
 * 7. Validation & Feedback
 *    - Real-time validation messaging
 *    - Error display in toolbar
 *    - Success notifications
 *    - Validate button for manual checks
 *    - Clear canvas with confirmation
 * 
 * ========================================
 * TECHNICAL DETAILS
 * ========================================
 * 
 * Architecture:
 * - React functional components with hooks
 * - useState for workflow state
 * - useEffect for auto-save and validation
 * - useRef for canvas/DOM access
 * - TypeScript for type safety
 * - localStorage API for persistence
 * 
 * Canvas Implementation:
 * - HTML5 Canvas for background (grid, edges)
 * - Absolute positioned React elements for nodes
 * - Custom hit detection for click/drag interactions
 * - DrawArrow function for edge rendering
 * 
 * Validation:
 * - Stage order tracking via stageOrder array
 * - Recursive stage index checking
 * - Operator type detection
 * - Error collection and reporting
 * 
 * File Structure:
 * src/app/components/
 * ├── TradeFlow.tsx (main component)
 * └── TradeFlow/
 *     ├── types.ts (type definitions)
 *     ├── storage.ts (state management)
 *     ├── validators.ts (validation logic)
 *     ├── NodeLibrary.tsx (left panel)
 *     ├── WorkflowCanvas.tsx (center panel)
 *     ├── WorkflowNode.tsx (node component)
 *     └── NodeInspector.tsx (right panel)
 * 
 * ========================================
 * USAGE GUIDE
 * ========================================
 * 
 * 1. Navigate to TradeFlow in header
 * 2. Expand stage categories in Node Library
 * 3. Drag node onto canvas
 * 4. Click node to select and edit in inspector
 * 5. Right-click node and drag to another to connect
 * 6. Click Validate to check workflow
 * 7. Click Save to persist workflow
 * 8. Click Export to download as JSON
 * 9. Click Clear to reset canvas
 * 
 * ========================================
 * FUTURE ENHANCEMENTS (Optional)
 * ========================================
 * 
 * - Multi-select and bulk operations
 * - Copy/paste nodes and subgraphs
 * - Undo/redo functionality
 * - Zoom controls
 * - Workflow templates
 * - Expression builder UI for complex conditions
 * - Node grouping/containers
 * - Workflow execution simulation
 * - Integration with actual trading backend
 */
