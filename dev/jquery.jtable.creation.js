/************************************************************************
* CREATE RECORD extension for jTable                                    *
*************************************************************************/
(function ($) {

    //Reference to base object members
    var base = {
        _create: $.hik.jtable.prototype._create
    };

    //extension members
    $.extend(true, $.hik.jtable.prototype, {

        /************************************************************************
        * DEFAULT OPTIONS / EVENTS                                              *
        *************************************************************************/
        options: {

            //Events
            recordAdded: function (event, data) { },

            //Localization
            messages: {
                addNewRecord: 'Add new record'
            }
        },

        /************************************************************************
        * PRIVATE FIELDS                                                        *
        *************************************************************************/

        _$addRecordDiv: null, //Reference to the adding new record dialog div (jQuery object)

        /************************************************************************
        * CONSTRUCTOR                                                           *
        *************************************************************************/

        /* Overrides base method to do create-specific constructions.
        *************************************************************************/
        _create: function () {
            base._create.apply(this, arguments);
            
            if (!this.options.actions.createAction) {
                return;
            }
            
            this._createAddRecordDialogDiv();
        },

        /* Creates and prepares add new record dialog div
        *************************************************************************/
        _createAddRecordDialogDiv: function () {
            var self = this;

            //Create a div for dialog and add to container element
            self._$addRecordDiv = $('<div />')
                .appendTo(self._$mainContainer);
            
            self._$addRecordDiv.addClass("modal fade");
            self._$addRecordDiv.css({
            	width: 'auto'
            });
            self._$addRecordDiv.append('<div class="modal-dialog"><div class="modal-content"><div class="modal-header">' +
            			'<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>' +
            			'<h3>' + self.options.messages.addNewRecord + '</h3></div>' +
            			'<div class="modal-body" style="min-width: 300px;"></div>' +
            			'<div class="modal-footer">' +
            			'<a href="#" class="btn" data-dismiss="modal" aria-hidden="true">' + self.options.messages.cancel + '</a>' +
            			'<a id="AddRecordDialogSaveButton" href="#" class="save btn btn-primary">' + self.options.messages.save + '</a></div>' +
            	        '</div></div>');
            self._$addRecordDiv.find(".save").click(function(event) {
            	self._onSaveClickedOnCreateForm();
            });
            	
            self._$addRecordDiv.modal({
            	show: false
            });
            	
            self._$addRecordDiv.on("hide.bs.modal", function (event) {
                var $addRecordForm = self._$addRecordDiv.find('form').first();
                var $saveButton = $('#AddRecordDialogSaveButton');
                self._trigger("formClosed", null, { form: $addRecordForm, formType: 'create' });
                self._setEnabledOfDialogButton(true, $saveButton, true, self.options.messages.save);
                $addRecordForm.remove();            		
            });            	

            if (self.options.addRecordButton) {
                //If user supplied a button, bind the click event to show dialog form
                self.options.addRecordButton.click(function (e) {
                    e.preventDefault();
                    self._showAddRecordForm();
                });
            } else {
                //If user did not supplied a button, create a 'add record button' toolbar item.
                self._addToolBarItem({
                    icon: true,
                    cssClass: 'jtable-toolbar-item-add-record',
                    text: self.options.messages.addNewRecord,
                    click: function () {
                        self._showAddRecordForm();
                    }
                });
            }
        },
        
        _onSaveClickedOnCreateForm: function () {
            var self = this;
            
            var $saveButton = $('#AddRecordDialogSaveButton');
            var $addRecordForm = self._$addRecordDiv.find('form');

            if (self._trigger("formSubmitting", null, { form: $addRecordForm, formType: 'create' }) != false) {
                self._setEnabledOfDialogButton(true, $saveButton, false, self.options.messages.saving);
                self._saveAddRecordForm($addRecordForm, $saveButton);
            }
        },

        /************************************************************************
        * PUBLIC METHODS                                                        *
        *************************************************************************/

        /* Shows add new record dialog form.
        *************************************************************************/
        showCreateForm: function () {
            this._showAddRecordForm();
        },

        /* Adds a new record to the table (optionally to the server also)
        *************************************************************************/
        addRecord: function (options) {
            var self = this;
            options = $.extend({
                clientOnly: false,
                animationsEnabled: self.options.animationsEnabled,
                url: self.options.actions.createAction,
                success: function () { },
                error: function () { }
            }, options);

            if (!options.record) {
                self._logWarn('options parameter in addRecord method must contain a record property.');
                return;
            }

            if (options.clientOnly) {
                self._addRow(
                    self._createRowFromRecord(options.record), {
                        isNewRow: true,
                        animationsEnabled: options.animationsEnabled
                    });
                
                options.success();
                return;
            }

            self._submitFormUsingAjax(
                options.url,
                $.param(options.record),
                function (data) {
                    if (data.Result != 'OK') {
                        self._showError(data.Message);
                        options.error(data);
                        return;
                    }
                    
                    if(!data.Record) {
                        self._logError('Server must return the created Record object.');
                        options.error(data);
                        return;
                    }

                    self._onRecordAdded(data);
                    
                    self._addRow(
                        self._createRowFromRecord(data.Record), {
                            isNewRow: true,
                            animationsEnabled: options.animationsEnabled
                        });

                    options.success(data);
                },
                function () {
                    self._showError(self.options.messages.serverCommunicationError);
                    options.error();
                });
        },

        /************************************************************************
        * PRIVATE METHODS                                                       *
        *************************************************************************/

        /* Shows add new record dialog form.
        *************************************************************************/
        _showAddRecordForm: function () {
            var self = this;

            //Create add new record form
            var $addRecordForm = $('<form id="jtable-create-form" class="jtable-dialog-form jtable-create-form"></form>');

            //Create input elements
            for (var i = 0; i < self._fieldList.length; i++) {

                var fieldName = self._fieldList[i];
                var field = self.options.fields[fieldName];

                //Do not create input for fields that is key and not specially marked as creatable
                if (field.key == true && field.create != true) {
                    continue;
                }

                //Do not create input for fields that are not creatable
                if (field.create == false) {
                    continue;
                }

                if (field.type == 'hidden') {
                    $addRecordForm.append(self._createInputForHidden(fieldName, field.defaultValue));
                    continue;
                }

                //Create a container div for this input field and add to form
                var $fieldContainer = $('<div />')
                    .addClass('jtable-input-field-container')
                    .appendTo($addRecordForm);

                //Create a label for input
                $fieldContainer.append(self._createInputLabelForRecordField(fieldName));

                //Create input element
                $fieldContainer.append(
                    self._createInputForRecordField({
                        fieldName: fieldName,
                        formType: 'create',
                        form: $addRecordForm
                    }));
            }

            self._makeCascadeDropDowns($addRecordForm, undefined, 'create');

            $addRecordForm.submit(function () {
                self._onSaveClickedOnCreateForm();
                return false;
            });

            //Open the form
            self._$addRecordDiv.find(".modal-body").append($addRecordForm);
            self._$addRecordDiv.modal('show');
            
            self._trigger("formCreated", null, { form: $addRecordForm, formType: 'create' });
        },

        /* Saves new added record to the server and updates table.
        *************************************************************************/
        _saveAddRecordForm: function ($addRecordForm, $saveButton) {
            var self = this;

            //Make an Ajax call to update record
            $addRecordForm.data('submitting', true);

            self._submitFormUsingAjax(
                self.options.actions.createAction,
                $addRecordForm.serialize(),
                function (data) {
                    
                    if (data.Result != 'OK') {
                        self._showError(data.Message);
                        self._setEnabledOfDialogButton(true, $saveButton, true, self.options.messages.save);
                        return;
                    }
                    
                    if (!data.Record) {
                        self._logError('Server must return the created Record object.');
                        self._setEnabledOfDialogButton(true, $saveButton, true, self.options.messages.save);
                        return;
                    }

                    self._onRecordAdded(data);
                    self._addRow(
                        self._createRowFromRecord(data.Record), {
                            isNewRow: true
                        });
                    self._$addRecordDiv.modal("hide");
                },
                function () {
                    self._showError(self.options.messages.serverCommunicationError);
                    self._setEnabledOfDialogButton(true, $saveButton, true, self.options.messages.save);
                });
        },

        _onRecordAdded: function (data) {
            this._trigger("recordAdded", null, { record: data.Record, serverResponse: data });
        }

    });

})(jQuery);
