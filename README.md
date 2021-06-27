# ui5-ts-codegen README

This is a Visual Studio Code plugin that generates typescript code for SAPUI5/OpenUI5 model classes.

## Features

Generate getters/setters and contextPath builders based on the defined data structure of the model.

# Why generate code?
UI5 models has helper functions like setProperty/getProperty to set and get data. However, you would need to know the full data structure of each of your models before you even use it. To make it easier to maintain, this code generator would automatically create the getters and setters for each data on your model.

# Requirements
This script expects the following:
- you are using typescript on your project
- you are using gulp
- you have a base class that you use on all your models and this base class has a generic type argument defined. Example:
```
/**
 * Interface representing the data used on the model.
 */
export interface ViewJSONModelData {
}

/**
 * Base class to use as JSONModel.
 *
 * @name spinifex.webdemo.models.ViewJSONModel
 */
export default abstract class ViewJSONModel<T extends ViewJSONModelData> extends JSONModel {
    constructor(oInitData: T ) {
        super(oInitData);
    }

    /**
     * Returns the entire data.
     */
    public getData() : T {
        // @ts-ignore
        return <T>super.getData();
    }
}
```


## Extension Settings

This extension contributes the following settings:

* `ui5-ts-codegen.parentClassName`: array of class names that will be treated as a JSONModel parent class; defaults to "ViewJSONModel" (see sample code above)

## Known Issues

This is still a WIP so please let me know if you encounter any issues.

## Release Notes

### 0.1

Initial release

**Enjoy!**