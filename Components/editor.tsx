import {
  defaultINode,
  formatNodes,
  getNodeId,
  getScopeRange,
  INode,
  ScopeRange,
} from "@/Helpers/helpers";
import Flow from "@/pages/flow";
import {
  ContractDefinition,
  FunctionDefinition,
  VariableDeclaration,
} from "@solidity-parser/parser/dist/src/ast-types";
import { useEffect, useMemo, useState } from "react";
import { ContractNode } from "./Nodes/ContractNode";
import { FunctionNode } from "./Nodes/FunctionNode";
import { LocalVariableNode } from "./Nodes/LocalVariableNode";
import { StateVariableNode } from "./Nodes/StateVariableNode";

import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-java";
import "ace-builds/src-noconflict/theme-github";
import "ace-builds/src-noconflict/ext-language_tools";
require("@solidity-parser/parser/dist/index.iife.js");

export default function EditorInterface() {
  // @ts-ignore
  const SolidityParser: any = window.SolidityParser;
  const { parse, visit, loc } = SolidityParser;

  const [text, setText] = useState(`\
contract Test {
  uint public num;
  
  uint public num2;
  
  string private secretStr;


  function test() public { 
    num = 69;
  }

  function shouldHaveLocal() public {
    uint local;
  }
}`);
  const [parsed, setParsed] = useState("");
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [detailLevel, setDetailLevel] = useState(3);
  const [nodeTypesToRemove, setNodeTypesToRemove] = useState<string[]>();
  const nodeTypes = useMemo(
    () => ({
      function: FunctionNode,
      stateVariable: StateVariableNode,
      localVariable: LocalVariableNode,
      contract: ContractNode,
    }),
    []
  );

  useEffect(() => {
    try {
      const parsed = parse(text, { loc: true, range: true });
      setParsed(parsed);
    } catch (_) {}
  }, [text]);

  async function onParseUpdate() {
    const newNodes: INode[] = [];

    const ranges: ScopeRange[] = [];

    try {
      visit(parsed, {
        ContractDefinition: async (node: ContractDefinition) => {
          const { range, name } = node;
          console.log("contract", node);

          // Add the range to the list of ranges
          const nodeScope = getScopeRange(range, name); // only constructor has no name
          ranges.push(nodeScope);

          // Add the contract to the new test nodes
          const nodeID = getNodeId(ranges, nodeScope.start);
          const emptyNode = defaultINode();
          const _node = {
            ...emptyNode,
            id: nodeID,
            label: name,
            type: "contract",
            data: {
              type: "contract",
              label: name,
              name,
              range,
            },
          };
          newNodes.push(_node);
        },

        FunctionDefinition: async (node: FunctionDefinition) => {
          const { range, name } = node;
          console.log("function", node);

          // if (!range || !name) return;
          // Add the range to the list of ranges
          const nodeScope = getScopeRange(
            range,
            name === null ? "constructor" : name
          );
          ranges.push(nodeScope);

          // Add the contract to the new test nodes
          const nodeID = getNodeId(ranges, nodeScope.start);
          const emptyNode = defaultINode();
          const _node = {
            ...emptyNode,
            id: nodeID,
            label: name,
            type: "function",
            data: {
              type: "function",
              label: name,
              name,
              range,
            },
          };
          newNodes.push(_node);
        },

        VariableDeclaration: async (node: VariableDeclaration) => {
          const { range, name } = node;
          console.log("variable", node);
          if (!range || !name) return;

          const nodeScope = getScopeRange(range, name);
          ranges.push(nodeScope);

          // Add the contract to the new test nodes
          const nodeID = getNodeId(ranges, nodeScope.start);
          const emptyNode = defaultINode();
          const _node = {
            ...emptyNode,
            id: nodeID,
            label: name,
            type: node.isStateVar ? "stateVariable" : "localVariable",
            data: {
              type: "variable",
              label: name,
              name,
              range,
            },
          };
          newNodes.push(_node);
        },
      });
    } catch (e) {
      console.error("Something went wrong: ", e);
    }
    // filter the nodes according to the level of detail we want
    const filteredNodes = newNodes.filter(
      (node) => node.id.split("-").length <= detailLevel && node.id.length > 0
    );
    // Position the nodes
    const [formattedNodes, formattedEdges] = await formatNodes(newNodes);

    // only set the nodes if there are formatted nodes to set, IE not in the middle of editing
    if (formattedNodes.length > 0) {
      // setNodes(formattedNodes);
      // setEdges(formattedEdges);
      setNodes(
        formattedNodes.filter(
          (node) =>
            node.id.split("-").length <= detailLevel &&
            !nodeTypesToRemove?.includes(node.type)
        ) // filter the nodes according to the level of detail we want
      );
      setEdges(
        formattedEdges.filter(
          (edge) => edge.source.split("-").length <= detailLevel
        ) // filter the nodes according to the level of detail we want
      );
    }
  }

  useEffect(() => {
    onParseUpdate();
  }, [parsed, detailLevel, nodeTypesToRemove]);

  return (
    <div className="h-screen w-screen flex">
      <div className="h-full w-1/2 flex justify-center">
        <div className="flex flex-col h-full w-full justify-flex-start">
          <div className="flex bg-slate-200 border-black border-2 justify-around">
            <div className="flex flex-col">
              Types to show:
              {Object.keys(nodeTypes).map((nodeType) => (
                <div className="flex flex-row">
                  <input
                    type="checkbox"
                    checked={!nodeTypesToRemove?.includes(nodeType)}
                    onChange={(e) => {
                      if (!e.target.checked) {
                        setNodeTypesToRemove([
                          ...(nodeTypesToRemove || []),
                          nodeType,
                        ]);
                      } else {
                        setNodeTypesToRemove(
                          nodeTypesToRemove?.filter((t) => t !== nodeType)
                        );
                      }
                    }}
                  />
                  <label>{nodeType}</label>
                </div>
              ))}
            </div>
            <div className="flex flex-col w-3/12 justify-around">
              <button
                className="bg-slate-400 rounded-full"
                onClick={() => {
                  setDetailLevel(detailLevel + 1);
                }}
              >
                Increase Detail
              </button>
              Detail Level: {detailLevel}
              <button
                className="bg-slate-400 rounded-full"
                onClick={() => {
                  setDetailLevel(detailLevel - 1);
                }}
              >
                Decrease Detail
              </button>
            </div>
          </div>
          <AceEditor
            mode="solidity"
            theme="monokai"
            value={text}
            keyboardHandler="vim"
            onChange={(code) => {
              setText(code);
            }}
            name="UNIQUE_ID_OF_DIV"
            editorProps={{ $blockScrolling: true }}
            height="100%"
          />
        </div>
      </div>
      <div className="h-full w-1/2 flex justify-center">
        <Flow defaultNodes={nodes} defaultEdges={edges} nodeTypes={nodeTypes} />
      </div>
    </div>
  );
}
