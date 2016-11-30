/*
 * Copyright 2016(c) The Ontario Institute for Cancer Research. All rights reserved.
 *
 * This program and the accompanying materials are made available under the terms of the GNU Public
 * License v3.0. You should have received a copy of the GNU General Public License along with this
 * program. If not, see <http://www.gnu.org/licenses/>.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR
 * IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
 * FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY
 * WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import deepmerge from 'deepmerge';

// Declaring 'icgc.donorlist', used in app.js
(function() {
  'use strict';

  angular.module ('icgc.donorlist', [
    'icgc.donorlist.controllers',
    'icgc.donorlist.services'
  ]);
})();

// DonorSetVerificationService
(function() {
  'use strict';

  var donorIdListParamName = 'donorIds';

  function donorIdList (input) {
    return donorIdListParamName + '=' + encodeURI (input);
  }

  var donorSetEndpointName = 'donorsets';
  var uiEndpointName = 'ui';

  // Angular wiring
  angular.module ('icgc.donorlist.services', [])
    .service ('DonorSetVerificationService', function (Restangular, LocationService, Extensions, Facets, SetService) {
    // Helpers
    function restEndpoint (endpointName) {
      return Restangular.one (endpointName)
          .withHttpConfig ({transformRequest: angular.identity});
    }

    var donorSetEndpoint = _.partial (restEndpoint, donorSetEndpointName);
    var uiEndpoint = _.partial (restEndpoint, uiEndpointName);

    function callDonorSetEndpoint (isValidationOnly, text, isExternalRepo) {
      var queryParams = {
        validationOnly: !! isValidationOnly,
        externalRepo: !! isExternalRepo
      };

      return donorSetEndpoint()
        .customPOST (donorIdList (text), undefined, queryParams);
    }

    // Public functions
    this.verifyIds = _.partial (callDonorSetEndpoint, true);
    /* Create new gene set based on text input - assumes input is already correct */
    this.createList = _.partial (callDonorSetEndpoint, false);

    /* Echo back the text content of file */
    this.readFileContent = function (filepath) {
      var data = new FormData();
      data.append ('filepath', filepath);

      return uiEndpoint().customPOST (data, 'search/file', {}, {'Content-Type': undefined});
    };

    this.updateDonorSetIdFilter = function (donorSetId, isExternalRepo) {
      var filters = LocationService.filters(),
          params = {type: 'donor', facet: 'id'},
          entityType = (isExternalRepo ? 'file' : 'donor'),
          entitySpecifier = isExternalRepo ?  'donorId' : 'id',
          entityID = [Extensions.ENTITY_PREFIX + donorSetId],
          isOrNot = Facets.isNot(params) ? 'not' : 'is';

      return _.set (filters, [entityType, entitySpecifier, isOrNot], entityID);
    };

    this.getDonorSets = () => _.filter(SetService.getAll(), (set) => set.type === 'donor' ? true : false);
  });

})();

// DonorListController
(function () {
  'use strict';

  angular.module ('icgc.donorlist.controllers', [])
    .controller ('DonorListController', function ($scope, $timeout, $location, $modalInstance,
    DonorSetVerificationService, LocationService, Page) {

    var DELAY = 1000;
    var verificationPromise = null;

    let filters = LocationService.filters();

    $scope.checkAll = false;
    $scope.isSavedSetVisible = true;
    $scope.isUploadSetVisible = false;
    $scope.donorSets = DonorSetVerificationService.getDonorSets();

    if(!$scope.donorSets.length){
      $scope.isSavedSetVisible = false;
      $scope.isUploadSetVisible = true;
    }

    /* Select/deselect all */
    $scope.toggleCheckAll = function() {
      $scope.checkAll = !$scope.checkAll;
      $scope.donorSets.forEach(function(set) {
        set.checked = $scope.checkAll;
      });
    };

    $scope.updateSelectedSets = () => {
      $scope.params.selectedSets = [];
      $scope.donorSets.forEach(function(set) {
        if (set.checked === true) {
          $scope.params.selectedSets.push(set);
        }
      });
      $scope.checkAll = ($scope.params.selectedSets.length === $scope.donorSets.length) ? true : false ;
    };

    // to check if a set was previously selected and is still in effect
    const checkSetInFilter = () => {
      if(filters.donor && filters.donor.id){
        $scope.params.selectedSets = [];
        _.each(filters.donor.id.is, (id) => {
          if(_.includes(id,'ES')){
            const set = _.find($scope.donorSets, function(set){
              return `ES:${set.id}` === id;
            });
            if(set){
              set.disabled = true;
            }
          }
        })
      }
    };

    function initialize() {
      $scope.params = {
        rawText: '',
        state: '',
        myFile: null,
        fileName: '',
        inputMethod: 'id',
        selectedSets: []
      };
      $scope.out = {};
      $scope.checkAll = false;
      checkSetInFilter();
      $timeout.cancel (verificationPromise);
    }
    initialize();

    $scope.isInRepositoryFile = Page.page() === 'repository';

    function setUiState (state) {
      $scope.params.state = state;
    }

    var verifyIds_ = DonorSetVerificationService.verifyIds;
    var readFileContent_ = DonorSetVerificationService.readFileContent;
    var createDonorList_ = DonorSetVerificationService.createList;
    var updateDonorSetIdFilter_ = DonorSetVerificationService.updateDonorSetIdFilter;

    function verifyUserInput() {
      setUiState ('verifying');

      verifyIds_ ($scope.params.rawText, $scope.isInRepositoryFile).then (function (result) {
        setUiState ('verified');

        $scope.out = result;
        $scope.numberOfUiColumns = (result.hasIcgcIds && result.hasSubmitterIds) ? 2 : 1;
        $scope.numberOfUiRows = _.keys (result.donorSet).length;
      });
    }

    function verifyFileUpload() {
      setUiState ('uploading');

      var uploadedFile = $scope.params.myFile;
      $scope.params.fileName = uploadedFile.name;

      var callback = function (result) {
        $scope.params.rawText = result.data;
        verifyUserInput();
      };

      // The $timeout is just to give sufficent time in order to convey system state
      $timeout (function() {
        readFileContent_ (uploadedFile).then (callback);
      }, DELAY);
    }

    function createDonorList() {
      createDonorList_ ($scope.params.rawText, $scope.isInRepositoryFile).then (function (result) {
        var search = LocationService.search();
        search.filters = angular.toJson (updateDonorSetIdFilter_ (result.donorListId, $scope.isInRepositoryFile));

        $location.path ($location.path()).search (search);
      });
    }

    function hasWarnings() {
      return ! _.isEmpty ($scope.out.warnings);
    }
    function hasInvalids() {
      return ! _.isEmpty ($scope.out.invalidIds);
    }
    function hasValids() {
      return $scope.numberOfUiRows > 0;
    }

    function clearFileUploadInfo() {
      $scope.params.fileName = null;
      $scope.params.myFile = null;
    }

    function closeMe () {
      $modalInstance.dismiss ('cancel');
    }
    $scope.cancel = closeMe;

    // Publicly visible
    $scope.hasWarnings = hasWarnings;
    $scope.hasBothValidsAndInvalidsButNoWarnings = function () {
      return hasValids() && hasInvalids() && (! hasWarnings());
    };
    $scope.hasValidsButNoWarnings = function () {
      return hasValids() && (! hasWarnings());
    };
    $scope.hasNeitherValidsNorWarnings = function () {
      return (! hasValids()) && (! hasWarnings());
    };

    $scope.isInState = function (state) {
      return state === $scope.params.state;
    };

    $scope.validIdCount = function () {
      var invalidIdCount = _.get ($scope, 'out.invalidIds.length', 0);
      return $scope.out.uploadIdCount - invalidIdCount;
    };

    $scope.save = function() {
      if(!_.isEmpty($scope.params.selectedSets)){
        _.each($scope.params.selectedSets, (set) => {
          filters = deepmerge(filters, set.advFilters);
        });
        LocationService.filters(filters);
        closeMe();
      } else {
        createDonorList();
        closeMe();
      }
    };

    // This triggers the upload after user selects a file.
    /* Daniel Chang's original comment: This may be a bit brittle, angularJS as of 1.2x
     * does not seem to have any native/clean
     * way of modeling [input type=file]. So to get file information, it is proxied through a
     * directive that gets the file value (myFile) from input $element
     * Possible issues with illegal invocation
     *  - https://github.com/danialfarid/ng-file-upload/issues/776#issuecomment-106929172
     */
    $scope.$watch ('params.myFile', function (newValue) {
      if (! newValue) {return;}

      verifyFileUpload();
    });

    $scope.verifyDonorInput = function() {
      // Clears UI artifacts set by previous file upload.
      clearFileUploadInfo();

      $timeout.cancel (verificationPromise);
      verificationPromise = $timeout (verifyUserInput, DELAY, true);
    };

    $scope.resetAll = function() {
      initialize();
    };

    $scope.$on ('$destroy', function() {
      initialize();
    });

  });
})();
