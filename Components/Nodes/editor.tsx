import Flow from "@/pages/flow";
import { useEffect, useMemo, useState } from "react";
import { ContractNode } from "./ContractNode";
import { FunctionNode } from "./FunctionNode";
import { LocalVariableNode } from "./LocalVariableNode";
import { StateVariableNode } from "./StateVariableNode";
import Parser, { Tree } from "web-tree-sitter";

import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-java";
import "ace-builds/src-noconflict/theme-github";
import "ace-builds/src-noconflict/ext-language_tools";
import {
  captureToScopeRange,
  contractGoodies,
  goodiesToINodes,
} from "@/Helpers/treeHelpers";
import {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  formatNodes,
  getScopeRange,
} from "@/Helpers/helpers";

export default function EditorInterface() {
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
}
contract Test2 {
  uint public num;
}`);

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

  // parser class
  const [parser, setParser] = useState<Parser>();

  // parsed syntax tree
  // should change every time the text changes
  const [parsedTree, setParsedTree] = useState<Tree>();

  const init = async () => {
    await Parser.init({
      locateFile(scriptName: string, scriptDirectory: string) {
        return scriptName;
      },
    });
    const Solidity = await Parser.Language.load("tree-sitter-solidity.wasm");

    const parser = new Parser();

    parser.setLanguage(Solidity);

    setParser(parser);
  };

  useEffect(() => {
    init();
  }, []);

  // set the parsed tree whenever the text changes
  // @dev I am not sure why the tree wasn't updating when we were passing in the old tree before. But it seems to be working now
  useEffect(() => {
    if (parser) {
      const tree = parser.parse(text);
      setParsedTree(tree);
    }
  }, [text, parser]);

  async function onParseUpdate() {
    if (parsedTree) {
      const language = parsedTree.getLanguage();

      const goodies = contractGoodies(language).matches(parsedTree.rootNode);
      console.log(
        "goodies",
        goodies
        // goodies.map((g) => g.node.text)
      );

      const scopeRange = goodies.flatMap((goodie) => {
        return captureToScopeRange(goodie.captures);
      });

      scopeRange.sort((a, b) => a.start - b.end);

      const rawNodes = goodies.flatMap((goodie) => {
        return goodiesToINodes(
          goodie,
          DEFAULT_NODE_HEIGHT,
          DEFAULT_NODE_WIDTH,
          scopeRange
        );
      });

      console.log("rawNodes", rawNodes);

      const [nodes, edges] = await formatNodes(rawNodes);
      setNodes(
        nodes.filter((node) => node.id.split("-").length <= detailLevel)
      );
      setEdges(edges);
    }
  }

  useEffect(() => {
    onParseUpdate();
  }, [parsedTree, detailLevel]);

  return (
    <div className="h-screen w-screen flex">
      <div className="h-full w-1/2 flex justify-center">
        <div className="flex flex-col h-full w-full justify-flex-start">
          <div className="flex bg-slate-200 border-black border-2 justify-around">
            <div className="flex flex-col">
              Types to show:
              {Object.keys(nodeTypes).map((nodeType) => (
                <div className="flex flex-row" key={nodeType}>
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
            mode="java"
            value={text}
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
