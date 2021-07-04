import * as vscode from 'vscode';

import * as ts from "typescript";
import Util, { AutoGenType } from '../util/Util';
import CodeGenerator, { UI5MemberReturnType } from './CodeGenerator';
import { Constants } from '../util/Constants';

interface ControlMetadataInfo {
    properties: UI5MemberReturnType[],
    aggregations: UI5MemberReturnType[],
    events: UI5MemberReturnType[]
}

/**
 * Class that generates getters/setters from metadata of a control
 */
export default class UI5ControlGenerator extends CodeGenerator {

    // @ts-ignore
    private typeChecker: ts.TypeChecker;

    /**
     * Processes the current file and adds/replaces the current generated region
     */
    public process() {
        const filePath = this.editor.document.fileName;

        try {
            // let { program, sourceFile } = this.createASTObjects({
            //     paths: {
            //         "sap/*": ["C:/Users/Levy/Documents/files/personal/vscode/ui5-ts-codegen/node_modules/ui5ts/exports/sap/*"]
            //     }
            // }, ["C:/Users/Levy/Documents/files/personal/vscode/ui5-ts-codegen/src/typings/ui5.d.ts"]);
            let program = ts.createProgram([filePath, "C:/Users/Levy/Documents/files/personal/vscode/ui5-ts-codegen/src/typings/ui5.d.ts"], {
                allowJs: true,
                paths: {
                    "sap/*": ["C:/Users/Levy/Documents/files/personal/vscode/ui5-ts-codegen/node_modules/ui5ts/exports/sap/*"]
                }
            });
            const sourceFile = program.getSourceFile(filePath);

            if (sourceFile) {
                this.typeChecker = program.getTypeChecker();
                const result = this.processCurrentFile(sourceFile);

                this.addOrReplaceGeneratedCode(sourceFile, result).then((value) => {
                    console.log("success: ", value);

                    vscode.window.showInformationMessage(`JSONModel code generated on ${filePath}`);
                }, (reason) => {
                    console.log("fail: ", reason);

                    vscode.window.showErrorMessage("Updating file failed: " + reason);
                });
            }
        } catch (e) {
            vscode.window.showErrorMessage("" + e);
        }
    }


    /**
     * Returns the parent class name based on the given class node.
     * @param {*} node
     */
    private getClassHierarchyInfo(classNode: ts.ClassDeclaration) {
        let returnList = [];

        let {parentClassType, typeGenerics} = this.getParentClass(classNode, this.typeChecker);
        while ( parentClassType ) {
            let namespaces = this.getFullNamespace(parentClassType);
            let metadataInfo = this.parseMetadataDecFromMembers(parentClassType);
            let className = namespaces.map(s => s.escapedName).join(".");
            let type = parentClassType;

            returnList.push({
                type, className, typeGenerics, metadataInfo
            });


            if ( parentClassType.valueDeclaration && !Util.isRootUI5Class(className) ) {
                let parent = this.getParentClass(parentClassType.valueDeclaration, this.typeChecker);
                parentClassType = parent.parentClassType;
                typeGenerics = parent.typeGenerics;
            } else {
                parentClassType = null;
                typeGenerics = null;
            }
            

            // let parentparent = this.getParentClass(parentClassType.valueDeclaration, this.typeChecker);

            // [{
            //     className: className,
            //     type: parentClassType,
            //     typeGenerics: typeGenerics,
            //     metadataInfo: parentMetadataInfo
            // }]

            // return {parentClassType, typeGenerics};

        }

        return returnList;

        // if (classNode.heritageClauses && classNode.heritageClauses.length) {
        //     for (let clause of classNode.heritageClauses) {
        //         if (clause.token === ts.SyntaxKind.ExtendsKeyword) {

        //             if (clause.types.length !== 1) {
        //                 console.warn(`error parsing extends expression "${clause.getText()}"`);
        //             } else {
        //                 let classType = clause.types[0];
        //                 let symbol = this.typeChecker.getSymbolAtLocation(classType.expression)!;
        //                 let parentClassType = this.typeChecker.getAliasedSymbol(symbol);
                        // let namespaces = this.getFullNamespace(parentClassType);
                        // let parentMetadataInfo = this.parseMetadataDecFromMembers(parentClassType);

                        // if (!symbol) {
                        //     console.warn(`error retrieving symbol for extends expression "${clause.getText()}"`);
                        // } else {

                            // let typeGenerics: string[] = [];
                            // if (classType.typeArguments && classType.typeArguments.length) {
                            //     // @ts-ignore
                            //     typeGenerics = classType.typeArguments.map(t => t.typeName.text);
                            // }

                            // return {
                            //     className: this.typeChecker.getFullyQualifiedName(symbol),
                            //     parentClassType: parentClassType,
                            //     classGenerics: typeGenerics
                            // };
                        // }
        //             }
        //         }
        //     }
        // }

        return null;
    }

    /**
     * Parses the file and returns the generated code content and other info.
     *
     * @param {*} file
     * @param {*} options
     */
    private processCurrentFile(sourceFile: ts.SourceFile): any {

        const returnObject = {
            content: "",
            pos: 0,
            end: 0,
            className: "",
            classGenerics: <string[]>[]
        };

        ts.forEachChild(sourceFile, node => {

            if (ts.isImportDeclaration(node)) {
                console.log(node);
            }

            // on class declaration:
            // - get parent class info (?)
            // - get metadata (should be static)
            if (ts.isClassDeclaration(node)) {
                let classNode = <ts.ClassDeclaration>node;
                let hierarchyList = this.getClassHierarchyInfo(classNode);
                let className = classNode.name?.text!;

                if (!hierarchyList) {
                    console.log(`Skipping class ${className} because it cannot parse the class hierarchy`);
                } else {

                    console.log(`Checking class ${className}...`, hierarchyList);

                    let metadataDec = this.getMetadataDefinition(classNode);

                    if (metadataDec) {
                        let metadataInfo = this.parseMetadata(metadataDec);
                        console.log(metadataInfo);

                        let fullContent = "";

                        fullContent += Util.getAutoGenMessage(className, AutoGenType.control);

                        if (metadataInfo.properties.length) {
                            fullContent += this.generatePropGettersAndSetters(classNode, metadataInfo.properties);
                        }

                        fullContent = `//#region Auto generated code\n${fullContent}\n//#endregion`;

                        returnObject.content = fullContent;
                        returnObject.className = className;

                        let lastToken = classNode.getLastToken();
                        if (lastToken) {
                            returnObject.pos = lastToken.pos;
                            returnObject.end = lastToken.end;
                        }
                    }

                }

            }

        });

        if (!returnObject.content) {
            throw new Error(`No class found that has a static metadata property `);
        }

        return returnObject;
    }

    /**
     * Returns the "static metadata {}" declaration from the class.
     * 
     * @param classType 
     * @returns 
     */
    private getMetadataDefinition(classType: ts.ClassDeclaration): ts.PropertyDeclaration {
        const foundMembers = classType.members.filter(member => this.isStaticMember(member) && member.name?.getText() === "metadata");
        return <ts.PropertyDeclaration>foundMembers[0];
    }

    /**
     * Parses the metadata declaration and returns the UI5MemberReturnType for the properties,
     * aggregations and events.
     * 
     * @param metadata 
     */
    private parseMetadata(metadata: ts.PropertyDeclaration) : ControlMetadataInfo {
        let returnObj = {
            properties: <UI5MemberReturnType[]>[],
            aggregations: <UI5MemberReturnType[]>[],
            events: <UI5MemberReturnType[]>[]
        };

        (<ts.ObjectLiteralExpression>metadata.initializer).properties.forEach(prop => {
            switch (prop.name?.getText().toUpperCase()) {
                case "PROPERTIES":
                    // @ts-ignore
                    returnObj.properties = this.parseMetadataProperties(prop);
                    break;
            }
        });

        return returnObj;
    }

    /**
     * Parses the metadata properties
     * @param metadataProps 
     * @returns 
     */
    private parseMetadataProperties(metadataProps: ts.PropertyDeclaration) {
        let returnArr: UI5MemberReturnType[] = [];

        (<ts.ObjectLiteralExpression>metadataProps.initializer).properties.forEach(prop => {

            returnArr.push({
                name: prop.name?.getText()!,
                type: this.getInitializerTextByTypeName(prop, "type"),
                // @ts-ignore
                comments: this.getJSDocComments(prop, this.typeChecker),
                defaultValue: this.getInitializerTextByTypeName(prop, "defaultValue"),
            });
        });

        return returnArr;
    }

    /**
     * Parses all the members of the parentClassType and determines the metadata used in declaring
     * this class.
     * 
     * @param parentClassType 
     * @returns 
     */
    private parseMetadataDecFromMembers(parentClassType : ts.Symbol) : ControlMetadataInfo {
        let propMembers : any = {};
        let aggrMembers : any = {};
        let eventMembers : any = {};

        parentClassType.members?.forEach(member => {

            // ignore protected and private
            if ( member.declarations?.length ) {
                const modifiers = member.declarations[0].modifiers;
                const isPublic = ! modifiers?.find(mod => mod.kind === ts.SyntaxKind.ProtectedKeyword || mod.kind === ts.SyntaxKind.PrivateKeyword);
                if ( isPublic ) {

                    // property (get/set)
                    const propName = Util.getTrimmedFromStart(member.name, ["get", "set"]);
                    if ( propName ) {
                        if ( !propMembers.hasOwnProperty(propName) ) {
                            propMembers[propName] = [];
                        }
                        propMembers[propName].push(member);

                        return;
                    }

                    // aggregation (add/insert/destroy)
                    const aggrName = Util.getTrimmedFromStart(member.name, ["add", "insert", "destroy"]);
                    if ( aggrName ) {
                        if ( !aggrMembers.hasOwnProperty(aggrName) ) {
                            aggrMembers[aggrName] = [];
                        }
                        aggrMembers[aggrName].push(member);

                        return;
                    }

                    // event (fire/detach)
                    const eventName = Util.getTrimmedFromStart(member.name, ["fire", "detach"]);
                    if ( eventName ) {
                        if ( !eventMembers.hasOwnProperty(eventName) ) {
                            eventMembers[eventName] = [];
                        }
                        eventMembers[eventName].push(member);

                        return;
                    }

                }
    
            }
        });

        // consolidate properties (should have both get/set)
        let returnProps : UI5MemberReturnType[] = [];
        for(const propName in propMembers) {

            let members : ts.Symbol[] = propMembers[propName];
            let getter = members.filter(member => member.name.startsWith("get"))[0];

            if ( getter && members.length === 2 ) {
                const memberType = getter.declarations![0];
                // @ts-ignore
                const signature = this.typeChecker.getSignatureFromDeclaration(memberType)!;
                const returnType = this.typeChecker.getReturnTypeOfSignature(signature);

                // @ts-ignore
                let typeName = returnType.intrinsicName;
                if ( !typeName && returnType.symbol ) {
                    typeName = this.getFullNamespace(returnType.symbol).map(s => s.escapedName).join(".");
                }

                returnProps.push({
                    name: propName,
                    type: typeName,
                    // @ts-ignore
                    comments: this.getJSDocComments(memberType, this.typeChecker),
                    // defaultValue: ""
                });
            }

        }

        // consolidate aggregation (should have add/insert/destroy)
        let returnAggr : UI5MemberReturnType[] = [];
        for(const aggrName in aggrMembers) {

            let members : ts.Symbol[] = aggrMembers[aggrName];
            let destMember = members.filter(member => member.name.startsWith("destroy"))[0];            
            let addMember = members.filter(member => member.name.startsWith("add"))[0];
            // destroy* method is sometimes declared in plural while add/insert is in singular
            if ( !addMember ) {
                let singular = aggrName.substr(0, aggrName.length-1);
                members = aggrMembers[singular] || [];
                addMember = members.filter(member => member.name.startsWith("add"))[0];
            }

            if ( addMember && destMember ) {
                const memberType = addMember.declarations![0];
                // @ts-ignore
                const signature = this.typeChecker.getSignatureFromDeclaration(memberType)!;
                const returnType = this.typeChecker.getReturnTypeOfSignature(signature);

                // @ts-ignore
                let typeName = returnType.intrinsicName;
                if ( !typeName && returnType.symbol ) {
                    typeName = this.getFullNamespace(returnType.symbol).map(s => s.escapedName).join(".");
                }

                returnAggr.push({
                    name: aggrName,
                    type: typeName,
                    // @ts-ignore
                    comments: this.getJSDocComments(memberType, this.typeChecker),
                    // defaultValue: ""
                });
            }
        }

        // consolidate events (should have fire/detach)
        let returnEvents : UI5MemberReturnType[] = [];
        for(const eventName in eventMembers) {

            let members : ts.Symbol[] = eventMembers[eventName];
            let getter = members.filter(member => member.name.startsWith("fire"))[0];

            if ( getter && members.length === 2 ) {
                const memberType = getter.declarations![0];
                // @ts-ignore
                // const signature = this.typeChecker.getSignatureFromDeclaration(memberType)!;
                // const returnType = this.typeChecker.getReturnTypeOfSignature(signature);

                // @ts-ignore
                // let typeName = returnType.intrinsicName;
                // if ( !typeName && returnType.symbol ) {
                //     typeName = this.getFullNamespace(returnType.symbol).map(s => s.escapedName).join(".");
                // }

                returnEvents.push({
                    name: eventName,
                    type: "",
                    // @ts-ignore
                    comments: this.getJSDocComments(memberType, this.typeChecker),
                    // defaultValue: ""
                });
            }
        }

        return {
            properties: returnProps,
            aggregations: returnAggr,
            events: returnEvents
        };
    }

    /**
     * Returns the text value of the given type name
     * @param prop 
     * @param typeName 
     * @returns 
     */
    private getInitializerTextByTypeName(prop: ts.ObjectLiteralElementLike, typeName: string): string {
        // @ts-ignore
        let found: ts.PropertyDeclaration = (<ts.ObjectLiteralExpression>prop.initializer).properties.filter(p => p.name?.getText() === typeName)[0];

        if (found && found.initializer?.kind === ts.SyntaxKind.StringLiteral) {
            return (<ts.StringLiteral>found.initializer).text;
        }

        return "";
    }

    /**
     * Returns the generated code for the constructors of this control
     * @param classType 
     * @param metadataInfo 
     */
    private generateConstructors(classType: ts.ClassDeclaration, metadataInfo: ControlMetadataInfo) {

    }

    /**
     * Returns the generated code for the getters and setters of the given properties
     * @param props 
     */
    private generatePropGettersAndSetters(classType: ts.ClassDeclaration, parsedTypes: UI5MemberReturnType[]) {
        let fullContent = "";

        parsedTypes.forEach(parsedType => {

            // getter
            fullContent += `/**\n`;
            fullContent += ` * Getter for ${parsedType.name} property of class ${classType.name?.getText()} \n`;
            if (parsedType.comments) {
                fullContent += ` * ${parsedType.comments} \n`;
            }
            fullContent += ` */\n`;
            fullContent += `public get${Util.toCamelCase(parsedType.name)}() : ${parsedType.type} {\n`;
            fullContent += `${Constants.spacer}return this.getProperty("${parsedType.name}"); \n`;
            fullContent += `}\n\n`;

            // setter
            fullContent += `/**\n`;
            fullContent += ` * Setter for ${parsedType.name} property of class ${classType.name?.getText()} \n`;
            if (parsedType.comments) {
                fullContent += ` * ${parsedType.comments} \n`;
            }
            fullContent += ` */\n`;
            fullContent += `public set${Util.toCamelCase(parsedType.name)}(vValue : ${parsedType.type}, bRerender? : boolean) {\n`;
            fullContent += `${Constants.spacer}return this.setProperty("${parsedType.name}", vValue, bRerender); \n`;
            fullContent += `}\n\n`;

        });

        return fullContent;
    }
}