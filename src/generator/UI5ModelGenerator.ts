// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import * as ts from "typescript";
import Util from '../util/Util';
import CodeGenerator, { UI5MemberReturnType, UI5ProcessReturnType } from './CodeGenerator';
import { Constants } from '../util/Constants';

// const through = require("through2");
// const ts = require("typescript");
const path = require("path");

export interface UI5ModelGeneratorOptions {
    parentClassName : string[]
}

// interface UI5ProcessReturnType {
//     content: string,
//     pos: number,
//     end: number,
//     className: string,
//     classGenerics: string[]
// }

/**
 * Class that generates getters/setters intended for JSONModel classes
 */
export default class UI5ModelGenerator extends CodeGenerator {

    private options : UI5ModelGeneratorOptions;

    /**
     * Constructor
     * @param options 
     */
    constructor(options?:UI5ModelGeneratorOptions) {
        super(options);
        
        const config = vscode.workspace.getConfiguration("ui5-ts-codegen");
        let defParentClassNames = config.get<string[]>("parentClassName");

        if ( !defParentClassNames ) {
            defParentClassNames = ["ViewJSONModel"];
        }

        this.options = options?.parentClassName ? options : { parentClassName : defParentClassNames };
    }
    
    /**
     * Processes the current file and adds/replaces the current generated region
     */
    public process() {
        const filePath = this.editor.document.fileName;

        // let program = ts.createProgram([filePath], { allowJs: true });
        // const sourceFile = program.getSourceFile(filePath);

        try {
            let {program, sourceFile} = this.createASTObjects();
    
            
            if ( sourceFile ) {
                const typeChecker = program.getTypeChecker();
                const result = this.processCurrentFile(sourceFile, typeChecker);
    
                this.addOrReplaceGeneratedCode(sourceFile, result).then((value) => {
                    console.log("success: ", value);
        
                    vscode.window.showInformationMessage(`JSONModel code generated on ${filePath}`);
                }, (reason) => {
                    console.log("fail: ", reason);
        
                    vscode.window.showErrorMessage("Updating file failed: " + reason);
                });
            }
        } catch(e) {
            vscode.window.showErrorMessage("" + e);
        }

    }

    // /**
    //  * Adds or Replaces the generated code in the content.
    //  *
    //  * @param {*} origContent
    //  * @param {*} pos
    //  * @param {*} generatedCode
    //  */
    // private addOrReplaceGeneratedCode(sourceFile : ts.SourceFile, processResult:UI5ProcessReturnType) {

    //     let doc = this.editor.document;
    //     let wsEdit = new vscode.WorkspaceEdit();
    //     let origContent = doc.getText();

    //     const startIndex = origContent.indexOf(Constants.anchorStart);
    //     const endIndex = origContent.indexOf(Constants.anchorEnd);

    //     let generatedCode = processResult.content;
    //     // add spacer at every newline
    //     generatedCode = generatedCode.replace(/\n/g,`\n${Constants.spacer}`);
    //     generatedCode = `\n\n${Constants.spacer}${Constants.anchorStart}\n${Constants.spacer}${generatedCode}\n\n${Constants.spacer}${Constants.anchorEnd}\n`;

    //     let posDefine = null;

    //     // if the generated code exists, replace the existing region
    //     if ( startIndex > -1 ) {
    //         if ( endIndex === -1 ) {
    //             throw new Error("Not able to find end anchor in file! Try deleting the entire AUTO GENERATED region and then re-run this action");
    //         }

    //         if ( processResult.pos < startIndex ) {
    //             throw new Error("Auto generated anchor start is after the closing of class! Try deleting the entire AUTO GENERATED region and then re-run this action");
    //         }

    //         generatedCode = generatedCode.trimStart();

    //         // let contentAfterGenCode = "";
    //         const numNewLines = Util.countOccurrences(generatedCode, "\n");
    
    //         posDefine = doc.positionAt(startIndex);
    //         wsEdit.replace(
    //             doc.uri,
    //             new vscode.Range(posDefine.line, posDefine.character, posDefine.line + numNewLines, 0),
    //             generatedCode
    //         );

    //     } else {

    //         // otherwise, insert in the class
    //         posDefine = doc.positionAt(processResult.pos+1);

    //         wsEdit.insert(doc.uri, posDefine, generatedCode);
    //     }


    //     return vscode.workspace.applyEdit(wsEdit);

    // };

    
    /**
     * Parses the file and returns the generated code content and other info.
     *
     * @param {*} file
     * @param {*} options
     */
    private processCurrentFile(sourceFile : ts.SourceFile, typeChecker : ts.TypeChecker) : UI5ProcessReturnType {

    
        const returnObject = {
            content: "",
            pos: 0,
            end: 0,
            className: "",
            classGenerics: <string[]>[]
        };
        let interfaces = <ts.InterfaceDeclaration[]>[];
    
        ts.forEachChild(sourceFile, node => {
    
            // on class declaration:
            // - get parent class and interface used (ignore if none)
            // - get position of the last closing bracket (kind == CloseBraceToken) so the caller will know where
            //   to insert the code to
            if ( ts.isClassDeclaration(node) ) {
                let classNode = <ts.ClassDeclaration>node;
                let classInfo = this.getParentClassInfo(classNode, typeChecker);
                let className = classNode.name?.text;

                if ( !classInfo ) {
                    console.log(`Skipping class ${className} because it cannot parse the class`);
                } else {

                    console.log(`Checking class ${className}...`);

                    // if not expected, then log and skip
                    if ( this.options?.parentClassName.indexOf(classInfo?.className) === -1 ) {
                        console.log(`Skipping class ${className} because it is extending ${classInfo.className} instead of expected class ${this.options?.parentClassName}`);
        
                    } else if ( !classInfo.classGenerics.length ) {
                        console.log(`Skipping class ${className} (${classInfo.className}) because it does not have any typeArguments `);
        
                    } else {
        
                        returnObject.className = classInfo.className;
                        returnObject.classGenerics = classInfo.classGenerics;

                        let lastToken = classNode.getLastToken();
                        if ( lastToken ) {
                            returnObject.pos = lastToken.pos;
                            returnObject.end = lastToken.end;
                        }
                        console.log(`...got ${returnObject.classGenerics} at ${ lastToken?.pos }, ${ lastToken?.end }`);
                    }
                }
    
            }
    
        });
    
        // the generic class defined on the parent class will be the data model;
        // if no generics defined, then throw an error
        if ( returnObject.classGenerics.length ) {
            // @ts-ignore
            ts.forEachChild(sourceFile, node => {
                if (ts.isInterfaceDeclaration(node) && returnObject.classGenerics.indexOf(node.name.text) > -1 ) {
                    interfaces.push(node);
                }
            });
    
            let fullContent = "";
    
            interfaces.forEach(iface => {
                let arrTypes : UI5MemberReturnType[] = [];
                iface.members.forEach(member => {
                    this.parseMember(member, null, typeChecker, arrTypes);
                });
   
                fullContent += Util.getAutoGenMessage(iface.name.text);
    
                // Getters and setters for each property
    
                fullContent += this.generateGettersAndSetters(iface, arrTypes);
    
                // Functions for paths
    
                fullContent += this.generatePathFunctions(iface, arrTypes);
    
    
                fullContent = `//#region Auto generated code\n${fullContent}\n//#endregion`;
            });
    
            returnObject.content = fullContent;
        } else {

            throw new Error(`No class found that inherits from one of the following parent classes: ${this.options.parentClassName.join(",") }`);
        }
    
        return returnObject;
    }
    
    
    // /**
    //  * Returns the pretty kind/type name based from the SyntaxKind enum from
    //  * Typescript.
    //  *
    //  * @param {*} kind
    //  */
    // private getSyntaxKind(kind:string) : string | undefined {
    //     for(let p in ts.SyntaxKind) {
    //         if ( kind === ts.SyntaxKind[p]) {
    //             return p;
    //         }
    //     }
    // };
    
    /**
     * Returns the parent class name based on the given class node.
     * @param {*} node
     */
    private getParentClassInfo(classNode:ts.ClassDeclaration, typeChecker:ts.TypeChecker) {
    
        if ( classNode.heritageClauses && classNode.heritageClauses.length ) {
            for (let clause of classNode.heritageClauses) {
                if ( clause.token === ts.SyntaxKind.ExtendsKeyword ) {
    
                    if (clause.types.length !== 1) {
                        console.warn(`error parsing extends expression "${clause.getText()}"`);
                    } else {
                        let classType = clause.types[0];
                        let symbol = typeChecker.getSymbolAtLocation(classType.expression);
    
                        if (!symbol) {
                            console.warn(`error retrieving symbol for extends expression "${clause.getText()}"`);
                        } else {
    
                            let typeGenerics : string[] = [];
                            if ( classType.typeArguments && classType.typeArguments.length ) {
                                // @ts-ignore
                                typeGenerics = classType.typeArguments.map(t => t.typeName.text);
                            }
    
                            return {
                                className: typeChecker.getFullyQualifiedName(symbol),
                                classGenerics: typeGenerics
                            };
                        }
                    }
                }
            }
        }
    
        return null;
    }
    
    // /**
    //  * Traverses the node hierarchy and builds the type information into the returned array
    //  * @param {*} member
    //  * @param {*} parents
    //  * @param {*} returnArray
    //  */
    // private parseMember(member:ts.TypeElement, parents : ts.TypeElement[] | null, typeChecker : ts.TypeChecker, returnArray : UI5MemberReturnType[]) {
    //     // @ts-ignore
    //     const prettyTypeName = typeChecker.typeToString(typeChecker.getTypeAtLocation(member.type));
    //     const jsDocComments = this.getJSDocComments(member, typeChecker);
    //     // @ts-ignore
    //     const parentPath = parents ? "/" + parents.map(p => p.name?.text).join("/") : "";

    //     if ( !parents ) {
    //         parents = [];
    //     }
    
    //     if ( !returnArray ) {
    //         returnArray = [];
    //     }
    
    //     let returnResult : UI5MemberReturnType = {
    //         // @ts-ignore
    //         name: member.name?.text,
    //         parentPath: parentPath,
    //         // @ts-ignore
    //         kindName: this.getSyntaxKind(member.type.kind),
    //         type: prettyTypeName,
    //         comments: jsDocComments,
    
    //         contextMembers: [] // objects under array
    //     };
    //     returnArray.push(returnResult);

    //     // @ts-ignore
    //     if ( member.type.members ) {
    //         // @ts-ignore
    //         member.type.members.forEach(submember => {
    //             // @ts-ignore
    //             this.parseMember(submember, parents.concat(member), typeChecker, returnArray);
    //         });
    
    //     // @ts-ignore
    //     } else if ( member.type.kind == ts.SyntaxKind.ArrayType && member.type.elementType.members ) {
    //         // if array of complex objects,
    
    //         // member.type.elementType.members
    //         let subReturnArray = <UI5MemberReturnType[]> [];
    //         // @ts-ignore
    //         member.type.elementType.members.forEach(arrMember => {
    //             this.parseMember(arrMember, null, typeChecker, subReturnArray);
    //         });
    
    //         returnResult.contextMembers = subReturnArray;
    
    //     }
    //     return returnArray;
    // };
    
    /**
     * Returns the JSDoc comments (if any)
     * @param {*} node
     */
    // private getJSDocComments(node : ts.TypeElement, typeChecker : ts.TypeChecker) {
    //     if ( node && node.name ) {
    //         const symbol = typeChecker.getSymbolAtLocation(node.name);
    //         if ( symbol ) {
    //             let comments = symbol.getDocumentationComment(typeChecker);
    //             if ( comments && comments.length ) {
    //                 return comments.map(c => c.text).join("\n");
    //             }
    //         }
    //     }
    
    //     return "";
    // }
    
    /**
     * Returns the generated code for the path() and fullPath functions.
     *
     * @param {*} arrTypes
     */
    private generatePathFunctions(iface : ts.InterfaceDeclaration, arrTypes : UI5MemberReturnType[]) {
        let propList = <{ jsdoc:string, prop:string, fullName:string }[]>[];
    
        let contextContent = "";
    
        // prepare paths into an array so that we can join them all later
        arrTypes.forEach(parsedType => {
            let fullName = parsedType.parentPath + "/" + parsedType.name;
            let prop = fullName.replace(/\//g, "_").replace(/^_/, "");
    
            propList.push({
                jsdoc: `/** @type {${parsedType.type}} path to ${fullName}; ${parsedType.comments} */`,
                prop: prop,
                fullName: fullName
            });
    
            if ( parsedType.contextMembers?.length ) {
                // console.log(parsedType.contextMembers);
    
                contextContent += this.generateContextPathFunctions(iface, parsedType, []);
            }
        });
    
        let fullContent = "";
    
        fullContent += `/**\n`;
        fullContent += ` * Paths to each data entry to this model, each defined in ${iface.name.text} \n`;
        fullContent += ` */\n`;
        fullContent += `public static path() {\n`;
        fullContent += `${Constants.spacer}return {\n${Constants.spacer+Constants.spacer}${propList.map(p => `${p.jsdoc}\n${Constants.spacer+Constants.spacer}${p.prop}: "${p.fullName}"` ).join(",\n"+Constants.spacer+Constants.spacer)} \n${Constants.spacer}};`;
        fullContent += `\n}\n`; // closing of get path()
    
        fullContent += `/**\n`;
        fullContent += ` * Full paths to each data entry to this model, each defined in ${iface.name.text} \n`;
        fullContent += ` */\n`;
        fullContent += `public static fullpath() {\n`;
        fullContent += `${Constants.spacer}return {\n${Constants.spacer+Constants.spacer}${propList.map(p => `${p.jsdoc}\n${Constants.spacer+Constants.spacer}${p.prop}: "{${p.fullName}}"` ).join(",\n"+Constants.spacer+Constants.spacer)} \n${Constants.spacer}};`;
        fullContent += `\n}\n`; // closing of get fullpath()
    
        fullContent += contextContent;
    
        return fullContent;
    };
    
    /**
     * Returns the generated code for the contextPath<propertyName>() and
     * fullContextPath<propertyName>() functions.
     *
     * @param {*} iface
     * @param {*} arrTypes
     */
    private generateContextPathFunctions(iface : ts.InterfaceDeclaration, typeWithContextMembers : UI5MemberReturnType, parents : UI5MemberReturnType[]) {
        
        let fullContent = "";
    
        let fullPath = parents.map(type => type.parentPath + "/" + type.name).join("/") + typeWithContextMembers.parentPath + "/" + typeWithContextMembers.name;
        const functionName = fullPath.split("/").map(s => Util.toCamelCase(s)).join("");
    
        // prepare paths into an array so that we can join them all later
        let propList = <string[]>[];
        let subContextContent = "";
        typeWithContextMembers.contextMembers.forEach(parsedType => {
            propList.push(parsedType.name);
    
            // if the contextMember also have another contextMember under it, then traverse
            if ( parsedType.contextMembers.length ) {
                subContextContent += this.generateContextPathFunctions(iface, parsedType, parents.concat(typeWithContextMembers));
            }
        });
    
        // contextPath()
        fullContent += `/**\n`;
        fullContent += ` * Paths to each data entry to this model (${iface.name.text}) under the context of ${fullPath.replace(/\/([^\/]+)/g, "/$1[]")} \n`;
        fullContent += ` */\n`;
        fullContent += `public static contextPath${functionName}() {\n`;
        fullContent += `${Constants.spacer}return {\n${Constants.spacer}${propList.map(p => `${Constants.spacer}${p}: "${p}"` ).join(",\n"+Constants.spacer)} \n${Constants.spacer}};`;
        fullContent += `\n}\n`;
    
        // contextFullPath()
        fullContent += `/**\n`;
        fullContent += ` * Paths to each data entry to this model (${iface.name.text}) under the context of ${fullPath.replace(/\/([^\/]+)/g, "/$1[]")} \n`;
        fullContent += ` */\n`;
        fullContent += `public static fullContextPath${functionName}() {\n`;
        fullContent += `${Constants.spacer}return {\n${Constants.spacer}${propList.map(p => `${Constants.spacer}${p}: "{${p}}"` ).join(",\n"+Constants.spacer)} \n${Constants.spacer}};`;
        fullContent += `\n}\n`;
    
        fullContent += subContextContent;
    
        return fullContent;
    
    
    };
    
    /**
     * Returns the generated code for the getters and setters of each property
     * in the data of this model.
     *
     * @param {*} iface
     * @param {*} arrTypes
     */
    private generateGettersAndSetters( iface: ts.InterfaceDeclaration, arrTypes: UI5MemberReturnType[]) {
        let fullContent = "";
    
        arrTypes.forEach(parsedType => {
            let fullPath = parsedType.parentPath + "/" + parsedType.name;
            let fullName = fullPath.split("/").map(s => Util.toCamelCase(s)).join("");
    
            fullContent += `/**\n`;
            fullContent += ` * Data of model property ${fullPath}; \n`;
            fullContent += ` * ${parsedType.comments} \n`;
            fullContent += ` * @see ${iface.name.text} \n`;
            fullContent += ` */\n`;
            fullContent += `public getData${fullName}() : ${parsedType.type} {\n`;
            fullContent += `${Constants.spacer}return this.getProperty("${fullPath}"); \n`
            fullContent += `}\n\n`
    
            fullContent += `/**\n`;
            fullContent += ` * Data of model property ${fullPath}; \n`;
            fullContent += ` * ${parsedType.comments} \n`;
            fullContent += ` * @see ${iface.name.text} \n`;
            fullContent += ` */\n`;
            fullContent += `public setData${fullName}(vValue:${parsedType.type}) {\n`;
            fullContent += `${Constants.spacer}this.setProperty("${fullPath}", vValue); \n`
            fullContent += `}\n\n`
    
        });
    
    
        return fullContent;
    };
    
}

