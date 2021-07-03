import * as vscode from 'vscode';

const EXTENSION_ID = "levybajamundi.ui5-ts-codegen";

export default class Util {
    /**
     * Converts string to camel case ("hello" => "Hello"; "helloWorld" => "HelloWorld")
     * @param {*} str
     */
    public static toCamelCase(str:string) {
        return str.charAt(0).toUpperCase() + str.substr(1);
    }

    /**
     * Returns the number of occurrences of word in origStr.
     * @param origStr 
     * @param word 
     */
    public static countOccurrences(origStr:string, word:string) {
        return origStr.split(word).length - 1;
    }

    /**
     * Returns a message that is intended to be placed as part of the autogenerated jsdoc.
     * @returns 
     */
    public static getAutoGenMessage(className:string) {
        let message = "";
        let version = vscode.extensions.getExtension(EXTENSION_ID)?.packageJSON.version;

        message += `//-----------------------------------------------------------------------------------\n`;
        message += `// Auto generated functions based from ${className} for use in OpenUI5 \n`;
        message += `// views and controllers. \n`;
        message += `//\n`;
        message += `// Generated using {@link https://github.com/tapsiturbi/ui5-ts-codegen} version ${version} \n`;
        message += `// on ${new Date().toString()} \n`;
        message += `//-----------------------------------------------------------------------------------\n\n`;

        return message;
    }
}