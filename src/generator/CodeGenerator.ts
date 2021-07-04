import * as vscode from 'vscode';
import * as ts from "typescript";
import { Constants } from '../util/Constants';
import Util from '../util/Util';

export interface UI5MemberReturnType {
    name: string,
    parentPath?: string,
    kindName?: string | undefined,
    type: string,
    comments?: string,
    defaultValue?: string,

    contextMembers?: UI5MemberReturnType[]
}

export interface UI5ProcessReturnType {
    content: string,
    pos: number,
    end: number,
    className: string,
    classGenerics: string[]
}

/**
 * Base class for all code generator classes
 */
export default abstract class CodeGenerator {

    protected editor: vscode.TextEditor;

    constructor(options?: any) {
        this.editor = <vscode.TextEditor>vscode.window.activeTextEditor;
    }


    /**
     * Performs the VSCode command
     */
    public abstract process(): void;

    /**
     * Creates all the necessary Typescript AST objects that will be used to analyze the code snippet that
     * is passed by VS Code
     * @param tsCode 
     */
    protected createASTObjects(programOptions:any = {}, extraFilePaths:string[] = []) {
        const filename = "test.ts";
        const currentCode = this.editor.document.getText();
        const sourceFile = ts.createSourceFile(filename, currentCode, ts.ScriptTarget.Latest);
        // let program = ts.createProgram(["temp.ts"], { allowJs: true });

        const defaultCompilerHost = ts.createCompilerHost({});

        const customCompilerHost: ts.CompilerHost = {
            getSourceFile: (name, languageVersion) => {
                console.log(`getSourceFile ${name}`);

                if (name === filename) {
                    return sourceFile;
                } else {
                    return defaultCompilerHost.getSourceFile(
                        name, languageVersion
                    );
                }
            },
            writeFile: (filename, data) => { },
            getDefaultLibFileName: () => "lib.d.ts",
            useCaseSensitiveFileNames: () => false,
            getCanonicalFileName: filename => filename,
            getCurrentDirectory: () => "",
            getNewLine: () => "\n",
            getDirectories: () => [],
            fileExists: () => true,
            readFile: () => ""
        };

        const program = ts.createProgram([filename].concat(extraFilePaths), programOptions, customCompilerHost);

        return { program, sourceFile };
    }

    /**
     * Adds or Replaces the generated code in the content.
     *
     * @param {*} origContent
     * @param {*} pos
     * @param {*} generatedCode
     */
    protected addOrReplaceGeneratedCode(sourceFile: ts.SourceFile, processResult: UI5ProcessReturnType) {

        let doc = this.editor.document;
        let wsEdit = new vscode.WorkspaceEdit();
        let origContent = doc.getText();

        const startIndex = origContent.indexOf(Constants.anchorStart);
        const endIndex = origContent.indexOf(Constants.anchorEnd);

        let generatedCode = processResult.content;
        // add spacer at every newline
        generatedCode = generatedCode.replace(/\n/g, `\n${Constants.spacer}`);
        generatedCode = `\n\n${Constants.spacer}${Constants.anchorStart}\n${Constants.spacer}${generatedCode}\n\n${Constants.spacer}${Constants.anchorEnd}\n`;

        let posDefine = null;

        // if the generated code exists, replace the existing region
        if (startIndex > -1) {
            if (endIndex === -1) {
                throw new Error("Not able to find end anchor in file! Try deleting the entire AUTO GENERATED region and then re-run this action");
            }

            if (processResult.pos < startIndex) {
                throw new Error("Auto generated anchor start is after the closing of class! Try deleting the entire AUTO GENERATED region and then re-run this action");
            }

            generatedCode = generatedCode.trimStart();

            // let contentAfterGenCode = "";
            const numNewLines = Util.countOccurrences(generatedCode, "\n");

            posDefine = doc.positionAt(startIndex);
            wsEdit.replace(
                doc.uri,
                new vscode.Range(posDefine.line, posDefine.character, posDefine.line + numNewLines, 0),
                generatedCode
            );

        } else {

            // otherwise, insert in the class
            posDefine = doc.positionAt(processResult.pos + 1);

            wsEdit.insert(doc.uri, posDefine, generatedCode);
        }


        return vscode.workspace.applyEdit(wsEdit);

    }


    /**
     * Returns the pretty kind/type name based from the SyntaxKind enum from
     * Typescript.
     *
     * @param {*} kind
     */
    protected getSyntaxKind(kind: string): string | undefined {
        for (let p in ts.SyntaxKind) {
            if (kind === ts.SyntaxKind[p]) {
                return p;
            }
        }
    }

    /**
     * Returns the JSDoc comments (if any)
     * @param {*} node
     */
    protected getJSDocComments(node: ts.TypeElement, typeChecker: ts.TypeChecker) {
        if (node && node.name) {
            const symbol = typeChecker.getSymbolAtLocation(node.name);
            if (symbol) {
                let comments = symbol.getDocumentationComment(typeChecker);
                if (comments && comments.length) {
                    return comments.map(c => c.text).join("\n");
                }
            }
        }

        return "";
    }

    /**
     * Traverses the node hierarchy and builds the type information into the returned array
     * @param {*} member
     * @param {*} parents
     * @param {*} returnArray
     */
    protected parseMember(member: ts.TypeElement, parents: ts.TypeElement[] | null, typeChecker: ts.TypeChecker, returnArray: UI5MemberReturnType[]) {
        // @ts-ignore
        const prettyTypeName = typeChecker.typeToString(typeChecker.getTypeAtLocation(member.type));
        const jsDocComments = this.getJSDocComments(member, typeChecker);
        // @ts-ignore
        const parentPath = parents ? "/" + parents.map(p => p.name?.text).join("/") : "";

        if (!parents) {
            parents = [];
        }

        if (!returnArray) {
            returnArray = [];
        }

        let returnResult: UI5MemberReturnType = {
            // @ts-ignore
            name: member.name?.text,
            parentPath: parentPath,
            // @ts-ignore
            kindName: this.getSyntaxKind(member.type.kind),
            type: prettyTypeName,
            comments: jsDocComments,

            contextMembers: [] // objects under array
        };
        returnArray.push(returnResult);

        // @ts-ignore
        if (member.type.members) {
            // @ts-ignore
            member.type.members.forEach(submember => {
                // @ts-ignore
                this.parseMember(submember, parents.concat(member), typeChecker, returnArray);
            });

            // @ts-ignore
        } else if (member.type.kind == ts.SyntaxKind.ArrayType && member.type.elementType.members) {
            // if array of complex objects,

            // member.type.elementType.members
            let subReturnArray = <UI5MemberReturnType[]>[];
            // @ts-ignore
            member.type.elementType.members.forEach(arrMember => {
                this.parseMember(arrMember, null, typeChecker, subReturnArray);
            });

            returnResult.contextMembers = subReturnArray;

        }
        return returnArray;
    }

    /**
     * Returns true if the returned class member has static declaration
     * @param classMember 
     * @returns 
     */
    protected isStaticMember(classMember: ts.ClassElement) {
        if (classMember.modifiers) {
            return classMember.modifiers.filter(modifier => modifier.kind === ts.SyntaxKind.StaticKeyword).length > 0;
        }
        return false;
    }

    /**
     * Returns all the nodes in the entire parent hierarchy that are of Namespace type.
     * @param symbol 
     * @param parents 
     * @returns 
     */
    protected getFullNamespace(symbol : ts.Symbol) {

        let hierarchy = [symbol];

        while(symbol.parent) {
            symbol = symbol.parent;
            hierarchy.push(symbol);
        }

        return hierarchy.reverse();

        // let newParents = [...parents];
        // if ( symbol.kind === ts.SyntaxKind.ModuleBlock) {
        //     newParents.push(symbol);
        // }
        // console.log(symbol);

        // if ( symbol.parent ) {
        //     return this.getFullNamespace(symbol.parent, newParents);
        // }
        // return newParents;
    }

    /**
     * Finds the class declaration based on the "extends" declaration of the given class.
     * @param classNode 
     * @param typeChecker 
     * @returns 
     */
    protected getParentClass(classNode: ts.ClassDeclaration, typeChecker: ts.TypeChecker) {
        if (classNode.heritageClauses && classNode.heritageClauses.length) {
            for (let clause of classNode.heritageClauses) {
                if (clause.token === ts.SyntaxKind.ExtendsKeyword) {

                    if (clause.types.length !== 1) {
                        console.warn(`error parsing extends expression "${clause.getText()}"`);
                    } else {
                        const classType = clause.types[0];
                        const symbol = typeChecker.getSymbolAtLocation(classType.expression)!;

                        let parentClassType = symbol;

                        // if external module imported via alias
                        if ( symbol.isReferenced ) {
                            parentClassType = typeChecker.getAliasedSymbol(symbol);
                        }

                        // const className = typeChecker.getFullyQualifiedName(symbol);

                        let typeGenerics: string[] = [];
                        if (classType.typeArguments && classType.typeArguments.length) {
                            // @ts-ignore
                            typeGenerics = classType.typeArguments.map(t => t.typeName.text);
                        }

                        return {parentClassType, typeGenerics};

                    }
                }
            }
        }

        return {parentClassType: null, typeGenerics: null};
    }
}