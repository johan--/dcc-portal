/*
 * Copyright 2018(c) The Ontario Institute for Cancer Research. All rights reserved.
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

(function() {
  'use strict';

  angular.module('icgc.oncololliplot', [
    'icgc.oncololliplot.directives',
    'icgc.oncololliplot.controllers',
  ]);
})();

(function() {
  'use strict';

  let module = angular.module('icgc.oncololliplot.directives', []);

  module.directive('oncoLolliplot', LocationService => ({
    restrict: 'E',
    replace: true,
    controller: 'OncoLolliplotController',
    scope: { transcripts: '=', highlightedPointId: '=' },
    templateUrl: '/scripts/oncololliplot/views/lolliplot.html',
    link: scope => {
      // Set inital linked scope properties
      scope.filters = LocationService.filters();

      // Update variables on change (will be called on initial load)
      scope.$on('$locationChangeSuccess', () => {
        scope.filters = LocationService.filters();
      });
    },
  }));
})();
